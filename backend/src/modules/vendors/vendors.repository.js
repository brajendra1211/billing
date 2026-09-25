const pool = require("../../config/db");

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

/* ---------------- Vendors ---------------- */
async function listVendors(companyId) {
  const [rows] = await pool.query(
    `SELECT id, name, phone, email, address, gstin, is_active, created_at
     FROM vendors
     WHERE company_id=?
     ORDER BY name ASC`,
    [companyId]
  );
  return rows;
}

async function createVendor(companyId, body) {
  const [r] = await pool.query(
    `INSERT INTO vendors (company_id, name, phone, email, address, gstin, is_active)
     VALUES (?,?,?,?,?,?,?)`,
    [companyId, body.name, body.phone || null, body.email || null, body.address || null, body.gstin || null, body.is_active ?? 1]
  );
  return r.insertId;
}

async function updateVendor(companyId, id, body) {
  const fields = [];
  const params = [];
  for (const k of ["name", "phone", "email", "address", "gstin", "is_active"]) {
    if (body[k] !== undefined) {
      fields.push(`${k}=?`);
      params.push(body[k]);
    }
  }
  if (!fields.length) return 0;
  const [r] = await pool.query(
    `UPDATE vendors SET ${fields.join(", ")} WHERE company_id=? AND id=?`,
    [...params, companyId, id]
  );
  return r.affectedRows;
}

/* ---------------- Services ---------------- */
async function listServices(companyId, vendorId) {
  const [rows] = await pool.query(
    `SELECT id, vendor_id, name, unit, rate, is_active, created_at
     FROM vendor_services
     WHERE company_id=? AND vendor_id=?
     ORDER BY name ASC`,
    [companyId, vendorId]
  );
  return rows;
}

async function createService(companyId, body) {
  const [r] = await pool.query(
    `INSERT INTO vendor_services (company_id, vendor_id, name, unit, rate, is_active)
     VALUES (?,?,?,?,?,?)`,
    [companyId, body.vendor_id, body.name, body.unit, body.rate, body.is_active ?? 1]
  );
  return r.insertId;
}

async function updateService(companyId, id, body) {
  const fields = [];
  const params = [];
  for (const k of ["vendor_id", "name", "unit", "rate", "is_active"]) {
    if (body[k] !== undefined) {
      fields.push(`${k}=?`);
      params.push(body[k]);
    }
  }
  if (!fields.length) return 0;
  const [r] = await pool.query(
    `UPDATE vendor_services SET ${fields.join(", ")} WHERE company_id=? AND id=?`,
    [...params, companyId, id]
  );
  return r.affectedRows;
}

/* ---------------- Consumption ---------------- */
async function listConsumption(companyId, q) {
  const vendorId = Number(q.vendor_id || 0) || 0;
  const from = (q.from || "").trim();
  const to = (q.to || "").trim();

  const where = ["c.company_id=?"];
  const params = [companyId];

  if (vendorId) { where.push("c.vendor_id=?"); params.push(vendorId); }
  if (from) { where.push("c.consume_date>=?"); params.push(from); }
  if (to) { where.push("c.consume_date<=?"); params.push(to); }

  const [rows] = await pool.query(
    `SELECT
        c.id, c.consume_date, c.qty, c.notes,
        v.id AS vendor_id, v.name AS vendor_name,
        s.id AS service_id, s.name AS service_name, s.unit, s.rate
     FROM vendor_consumption c
     JOIN vendors v ON v.id=c.vendor_id
     JOIN vendor_services s ON s.id=c.service_id
     WHERE ${where.join(" AND ")}
     ORDER BY c.consume_date DESC, c.id DESC
     LIMIT 500`,
    params
  );

  return rows.map(r => ({
    ...r,
    amount: round2(Number(r.qty) * Number(r.rate)),
  }));
}

async function createConsumption(companyId, userId, body) {
  const [r] = await pool.query(
    `INSERT INTO vendor_consumption
     (company_id, vendor_id, service_id, consume_date, qty, notes, created_by)
     VALUES (?,?,?,?,?,?,?)`,
    [companyId, body.vendor_id, body.service_id, body.consume_date, body.qty, body.notes || null, userId]
  );
  return r.insertId;
}

async function updateConsumption(companyId, id, body) {
  const fields = [];
  const params = [];
  for (const k of ["vendor_id", "service_id", "consume_date", "qty", "notes"]) {
    if (body[k] !== undefined) {
      fields.push(`${k}=?`);
      params.push(body[k]);
    }
  }
  if (!fields.length) return 0;
  const [r] = await pool.query(
    `UPDATE vendor_consumption SET ${fields.join(", ")} WHERE company_id=? AND id=?`,
    [...params, companyId, id]
  );
  return r.affectedRows;
}
// ✅ Upsert: same day same vendor same service => update qty/notes
async function upsertConsumption(conn, row) {
  // vendor_consumption has no unique key on (company, vendor, service, date),
  // so ON DUPLICATE KEY never fired and every save added a new row. Update-or-insert manually.
  const [existing] = await conn.query(
    `SELECT id FROM vendor_consumption
     WHERE company_id=? AND vendor_id=? AND service_id=? AND consume_date=?
     ORDER BY id ASC
     FOR UPDATE`,
    [row.company_id, row.vendor_id, row.service_id, row.consume_date]
  );

  if (existing[0]) {
    const [r] = await conn.query(
      `UPDATE vendor_consumption SET qty=?, notes=? WHERE id=?`,
      [row.qty, row.notes || null, existing[0].id]
    );
    return r.affectedRows;
  }

  const [r] = await conn.query(
    `INSERT INTO vendor_consumption
      (company_id, vendor_id, service_id, consume_date, qty, notes, created_by)
     VALUES (?,?,?,?,?,?,?)`,
    [
      row.company_id,
      row.vendor_id,
      row.service_id,
      row.consume_date,
      row.qty,
      row.notes || null,
      row.created_by || null,
    ]
  );
  return r.affectedRows;
}

/* ---------------- Bills ---------------- */
async function listBills(companyId, q) {
  const vendorId = Number(q.vendor_id || 0) || 0;
  const month = (q.bill_month || "").trim(); // YYYY-MM

  const where = ["b.company_id=?"];
  const params = [companyId];
  if (vendorId) { where.push("b.vendor_id=?"); params.push(vendorId); }
  if (month) { where.push("b.bill_month=?"); params.push(month); }

  const [rows] = await pool.query(
    `SELECT
        b.id, b.vendor_id, v.name AS vendor_name,
        b.bill_month, b.from_date, b.to_date,
        b.subtotal, b.paid_total, b.due_total, b.status, b.created_at
     FROM vendor_bills b
     JOIN vendors v ON v.id=b.vendor_id
     WHERE ${where.join(" AND ")}
     ORDER BY b.id DESC`,
    params
  );
  return rows;
}

async function getBill(companyId, billId) {
  const [bRows] = await pool.query(
    `SELECT b.*, v.name AS vendor_name
     FROM vendor_bills b
     JOIN vendors v ON v.id=b.vendor_id
     WHERE b.company_id=? AND b.id=? LIMIT 1`,
    [companyId, billId]
  );
  const bill = bRows[0] || null;
  if (!bill) return null;

  const [lines] = await pool.query(
    `SELECT l.*, s.name AS service_name
     FROM vendor_bill_lines l
     JOIN vendor_services s ON s.id=l.service_id
     WHERE l.bill_id=? ORDER BY l.id ASC`,
    [billId]
  );

  const [pays] = await pool.query(
    `SELECT id, paid_date, amount, mode, reference_no, notes, created_at
     FROM vendor_bill_payments
     WHERE company_id=? AND bill_id=?
     ORDER BY id DESC`,
    [companyId, billId]
  );

  return { bill, lines, payments: pays };
}

/* Generate bill from consumption lines */
async function generateBill(conn, { companyId, userId, vendorId, billMonth, fromDate, toDate }) {
  // ensure not exists
  const [existing] = await conn.query(
    `SELECT id FROM vendor_bills WHERE company_id=? AND vendor_id=? AND bill_month=? LIMIT 1`,
    [companyId, vendorId, billMonth]
  );
  if (existing[0]) {
    const err = new Error("Bill already exists for this vendor & month");
    err.statusCode = 400;
    throw err;
  }

  // aggregate from consumption
  const [agg] = await conn.query(
    `SELECT
        c.service_id,
        s.unit,
        s.rate,
        SUM(c.qty) AS qty
     FROM vendor_consumption c
     JOIN vendor_services s ON s.id=c.service_id
     WHERE c.company_id=? AND c.vendor_id=?
       AND c.consume_date BETWEEN ? AND ?
     GROUP BY c.service_id, s.unit, s.rate`,
    [companyId, vendorId, fromDate, toDate]
  );

  if (!agg.length) {
    const err = new Error("No consumption found in date range");
    err.statusCode = 400;
    throw err;
  }

  const lines = agg.map(r => {
    const qty = Number(r.qty || 0);
    const rate = Number(r.rate || 0);
    const line_total = round2(qty * rate);
    return { service_id: r.service_id, unit: r.unit, qty, rate, line_total };
  });

  const subtotal = round2(lines.reduce((s, x) => s + Number(x.line_total || 0), 0));

  const [ins] = await conn.query(
    `INSERT INTO vendor_bills
     (company_id, vendor_id, bill_month, from_date, to_date, subtotal, paid_total, due_total, status, created_by)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [companyId, vendorId, billMonth, fromDate, toDate, subtotal, 0, subtotal, "FINAL", userId]
  );
  const billId = ins.insertId;

  for (const l of lines) {
    await conn.query(
      `INSERT INTO vendor_bill_lines (bill_id, service_id, unit, qty, rate, line_total)
       VALUES (?,?,?,?,?,?)`,
      [billId, l.service_id, l.unit, l.qty, l.rate, l.line_total]
    );
  }

  return { billId };
}

async function addBillPayment(conn, { companyId, userId, billId, body }) {
  // lock bill
  const [b] = await conn.query(
    `SELECT * FROM vendor_bills WHERE company_id=? AND id=? FOR UPDATE`,
    [companyId, billId]
  );
  const bill = b[0];
  if (!bill) {
    const err = new Error("Bill not found");
    err.statusCode = 404;
    throw err;
  }
  if (bill.status === "PAID") {
    const err = new Error("Bill already PAID");
    err.statusCode = 400;
    throw err;
  }

  const amount = round2(body.amount);
  const currentDue = round2(Number(bill.due_total));
  if (amount > currentDue) {
    const err = new Error(`Amount cannot be more than due amount (${currentDue})`);
    err.statusCode = 400;
    throw err;
  }

  // insert payment
  await conn.query(
    `INSERT INTO vendor_bill_payments
     (company_id, bill_id, paid_date, amount, mode, reference_no, notes, created_by)
     VALUES (?,?,?,?,?,?,?,?)`,
    [companyId, billId, body.paid_date, amount, body.mode, body.reference_no || null, body.notes || null, userId]
  );

  // sum payments
  const [sum] = await conn.query(
    `SELECT COALESCE(SUM(amount),0) AS paid_total
     FROM vendor_bill_payments WHERE company_id=? AND bill_id=?`,
    [companyId, billId]
  );
  const paid_total = round2(Number(sum[0]?.paid_total || 0));
  let due_total = round2(Number(bill.subtotal) - paid_total);
  if (due_total < 0) due_total = 0;

  const status = due_total === 0 ? "PAID" : "FINAL";

  await conn.query(
    `UPDATE vendor_bills
     SET paid_total=?, due_total=?, status=?
     WHERE company_id=? AND id=?`,
    [paid_total, due_total, status, companyId, billId]
  );

  return { paid_total, due_total, status };
}

module.exports = {
  listVendors,
  createVendor,
  updateVendor,

  listServices,
  createService,
  updateService,

  listConsumption,
  createConsumption,
  updateConsumption,
  upsertConsumption,

  listBills,
  getBill,
  generateBill,
  addBillPayment,
};
