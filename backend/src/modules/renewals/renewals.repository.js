const pool = require("../../config/db");

async function listRenewals(companyId, q) {
  const status = (q.status || "").trim(); // ALL | DUE_SOON | OVERDUE
  const search = (q.search || "").trim();
  const today = (q.today || "").trim(); // pass from server or use CURDATE()

  const where = ["r.company_id=?"];
  const params = [companyId];

  if (search) {
    where.push("(r.name LIKE ? OR r.service_ref LIKE ? OR c.name LIKE ?)");
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (status === "OVERDUE") {
    where.push("r.is_active=1 AND r.next_due_date < CURDATE()");
  }
  if (status === "DUE_SOON") {
    where.push("r.is_active=1 AND r.next_due_date <= DATE_ADD(CURDATE(), INTERVAL r.remind_before_days DAY)");
  }

  const [rows] = await pool.query(
    `SELECT
      r.*,
      c.name AS customer_name
     FROM recurring_expenses r
     LEFT JOIN customers c ON c.id=r.customer_id
     WHERE ${where.join(" AND ")}
     ORDER BY r.next_due_date ASC, r.id DESC
     LIMIT 500`,
    params
  );

  return rows;
}

async function createRenewal(companyId, userId, body) {
  const [r] = await pool.query(
    `INSERT INTO recurring_expenses
     (company_id, customer_id, name, vendor_name, provider_name, service_type, service_ref,
      amount, currency, cycle, start_date, next_due_date, remind_before_days, is_active, notes)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      companyId,
      body.customer_id || null,
      body.name,
      body.vendor_name || null,
      body.provider_name || null,
      body.service_type || "OTHER",
      body.service_ref || null,
      body.amount,
      body.currency || "INR",
      body.cycle,
      body.start_date,
      body.next_due_date,
      body.remind_before_days ?? 7,
      body.is_active ?? 1,
      body.notes || null,
    ]
  );
  return r.insertId;
}

async function getRenewal(companyId, id) {
  const [rows] = await pool.query(
    `SELECT r.*, c.name AS customer_name
     FROM recurring_expenses r
     LEFT JOIN customers c ON c.id=r.customer_id
     WHERE r.company_id=? AND r.id=? LIMIT 1`,
    [companyId, id]
  );
  return rows[0] || null;
}

async function updateRenewal(companyId, id, body) {
  const fields = [];
  const params = [];

  const allowed = [
    "customer_id","name","vendor_name","provider_name","service_type","service_ref",
    "amount","currency","cycle","start_date","next_due_date","remind_before_days","is_active","notes"
  ];

  for (const k of allowed) {
    if (body[k] !== undefined) {
      fields.push(`${k}=?`);
      params.push(body[k]);
    }
  }
  if (!fields.length) return 0;

  const [r] = await pool.query(
    `UPDATE recurring_expenses SET ${fields.join(", ")} WHERE company_id=? AND id=?`,
    [...params, companyId, id]
  );
  return r.affectedRows;
}

async function listPayments(companyId, recurringId) {
  const [rows] = await pool.query(
    `SELECT id, recurring_id, paid_date, amount, mode, reference_no, notes, created_at
     FROM recurring_payments
     WHERE company_id=? AND recurring_id=?
     ORDER BY id DESC`,
    [companyId, recurringId]
  );
  return rows;
}

async function insertPayment(conn, companyId, userId, recurringId, body) {
  const [r] = await conn.query(
    `INSERT INTO recurring_payments
     (company_id, recurring_id, paid_date, amount, mode, reference_no, notes)
     VALUES (?,?,?,?,?,?,?)`,
    [companyId, recurringId, body.paid_date, body.amount, body.mode, body.reference_no || null, body.notes || null]
  );
  return r.insertId;
}

async function sumPayments(conn, companyId, recurringId) {
  const [rows] = await conn.query(
    `SELECT COALESCE(SUM(amount),0) AS total_paid
     FROM recurring_payments
     WHERE company_id=? AND recurring_id=?`,
    [companyId, recurringId]
  );
  return rows[0] || { total_paid: 0 };
}

async function updateNextDue(conn, companyId, recurringId, patch) {
  const [r] = await conn.query(
    `UPDATE recurring_expenses
     SET last_paid_date=?, next_due_date=?, updated_at=NOW()
     WHERE company_id=? AND id=?`,
    [patch.last_paid_date, patch.next_due_date, companyId, recurringId]
  );
  return r.affectedRows;
}

async function findOrCreateRenewalItem(conn, companyId) {
  const [rows] = await conn.query(
    `SELECT id FROM items
     WHERE company_id=? AND name='Renewal Service'
     LIMIT 1`,
    [companyId]
  );
  if (rows[0]) return rows[0].id;

  const [res] = await conn.query(
    `INSERT INTO items (company_id, type, name, sale_price, tax_percent, hsn_sac, unit)
     VALUES (?, 'SERVICE', 'Renewal Service', 0, 18, NULL, 'Nos')`,
    [companyId]
  );
  return res.insertId;
}

async function markInvoiceCreated(conn, companyId, recurringId, invoiceId, invoiceDate) {
  const [r] = await conn.query(
    `UPDATE recurring_expenses
     SET last_invoice_id=?, last_invoice_date=?, updated_at=NOW()
     WHERE company_id=? AND id=?`,
    [invoiceId, invoiceDate, companyId, recurringId]
  );
  return r.affectedRows;
}

async function dashboardAlerts(companyId) {
  const [soon] = await pool.query(
    `SELECT COUNT(*) AS cnt
     FROM recurring_expenses
     WHERE company_id=? AND is_active=1
       AND next_due_date <= DATE_ADD(CURDATE(), INTERVAL remind_before_days DAY)
       AND next_due_date >= CURDATE()`,
    [companyId]
  );

  const [overdue] = await pool.query(
    `SELECT COUNT(*) AS cnt
     FROM recurring_expenses
     WHERE company_id=? AND is_active=1
       AND next_due_date < CURDATE()`,
    [companyId]
  );

  return {
    due_soon: Number(soon[0]?.cnt || 0),
    overdue: Number(overdue[0]?.cnt || 0),
  };
}
async function getRenewalForUpdate(conn, companyId, id) {
  const [rows] = await conn.query(
    `SELECT * FROM recurring_expenses WHERE company_id=? AND id=? FOR UPDATE`,
    [companyId, id]
  );
  return rows[0] || null;
}
module.exports = {
  listRenewals,
  createRenewal,
  getRenewal,
  updateRenewal,
  listPayments,
  insertPayment,
  sumPayments,
  updateNextDue,
  dashboardAlerts,
  getRenewalForUpdate,
  findOrCreateRenewalItem,
  markInvoiceCreated,
};
