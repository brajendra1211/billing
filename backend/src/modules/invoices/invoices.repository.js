const pool = require("../../config/db");

// fetch item master for calc (type, hsn_sac, unit etc.)
async function getItemById(companyId, itemId) {
  const [rows] = await pool.query(
    "SELECT id, type, name, hsn_sac, unit, sale_price, tax_percent FROM items WHERE id=? AND company_id=? LIMIT 1",
    [itemId, companyId]
  );
  return rows[0] || null;
}

async function createInvoiceHeader(conn, invoice) {
  const [res] = await conn.query(
    `INSERT INTO invoices
     (company_id, customer_id, financial_year, prefix, invoice_date, due_date, place_of_supply_state, is_interstate,
      notes, terms, subtotal, discount_total, taxable_total, cgst_total, sgst_total, igst_total, round_off,
      grand_total, paid_total, due_total, status, created_by, updated_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      invoice.company_id,
      invoice.customer_id,
      invoice.financial_year,
      invoice.prefix,
      invoice.invoice_date,
      invoice.due_date,
      invoice.place_of_supply_state,
      invoice.is_interstate,

      invoice.notes,
      invoice.terms,

      invoice.subtotal,
      invoice.discount_total,
      invoice.taxable_total,
      invoice.cgst_total,
      invoice.sgst_total,
      invoice.igst_total,
      invoice.round_off,

      invoice.grand_total,
      invoice.paid_total,
      invoice.due_total,
      invoice.status,
      invoice.created_by,
      invoice.updated_by,
    ]
  );
  return res.insertId;
}

async function insertInvoiceItem(conn, row) {
  await conn.query(
    `INSERT INTO invoice_items
     (invoice_id, item_id, type, description, hsn_sac, unit, qty, rate,
      discount_percent, discount_amount, tax_percent, taxable_amount, cgst_amount, sgst_amount, igst_amount, line_total)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      row.invoice_id,
      row.item_id,
      row.type,
      row.description,
      row.hsn_sac,
      row.unit,
      row.qty,
      row.rate,
      row.discount_percent,
      row.discount_amount,
      row.tax_percent,
      row.taxable_amount,
      row.cgst_amount,
      row.sgst_amount,
      row.igst_amount,
      row.line_total,
    ]
  );
}

// lock series row + increment
async function nextInvoiceNumber(conn, companyId, financialYear, prefix) {
  // try lock existing row
  const [rows] = await conn.query(
    "SELECT id, last_number FROM invoice_series WHERE company_id=? AND financial_year=? AND prefix=? FOR UPDATE",
    [companyId, financialYear, prefix]
  );

  if (rows.length === 0) {
    // create series row if not exists
    await conn.query(
      "INSERT INTO invoice_series (company_id, financial_year, prefix, last_number) VALUES (?,?,?,0)",
      [companyId, financialYear, prefix]
    );
    // lock again
    const [rows2] = await conn.query(
      "SELECT id, last_number FROM invoice_series WHERE company_id=? AND financial_year=? AND prefix=? FOR UPDATE",
      [companyId, financialYear, prefix]
    );
    const next = rows2[0].last_number + 1;
    await conn.query("UPDATE invoice_series SET last_number=? WHERE id=?", [next, rows2[0].id]);
    return next;
  } else {
    const next = rows[0].last_number + 1;
    await conn.query("UPDATE invoice_series SET last_number=? WHERE id=?", [next, rows[0].id]);
    return next;
  }
}

async function finalizeInvoice(conn, invoiceId, companyId, invoice_number, invoice_no) {
  const [res] = await conn.query(
    `UPDATE invoices
     SET invoice_number=?, invoice_no=?, status='FINAL', finalized_at=COALESCE(finalized_at, NOW()), updated_at=NOW()
     WHERE id=? AND company_id=?`,
    [invoice_number, invoice_no, invoiceId, companyId]
  );
  return res.affectedRows;
}

async function markInvoiceSent(conn, companyId, invoiceId, channel) {
  const [res] = await conn.query(
    `UPDATE invoices
     SET sent_at=NOW(), updated_at=NOW()
     WHERE id=? AND company_id=?`,
    [invoiceId, companyId]
  );
  return res.affectedRows;
}

async function insertReminder(conn, { companyId, invoiceId, userId, reminderDate, channel, note }) {
  const [res] = await conn.query(
    `INSERT INTO invoice_reminders
     (company_id, invoice_id, channel, reminder_date, note, created_by)
     VALUES (?,?,?,?,?,?)`,
    [companyId, invoiceId, channel, reminderDate, note || null, userId || null]
  );
  await conn.query(
    `UPDATE invoices
     SET last_reminder_at=NOW(), last_reminder_channel=?, updated_at=NOW()
     WHERE id=? AND company_id=?`,
    [channel, invoiceId, companyId]
  );
  return res.insertId;
}

async function listReminders(companyId, invoiceId) {
  const [rows] = await pool.query(
    `SELECT id, invoice_id, channel, reminder_date, note, created_by, created_at
     FROM invoice_reminders
     WHERE company_id=? AND invoice_id=?
     ORDER BY id DESC`,
    [companyId, invoiceId]
  );
  return rows;
}

async function listAudit(companyId, invoiceId) {
  const [rows] = await pool.query(
    `SELECT id, user_id, action, old_values, new_values, note, created_at
     FROM audit_logs
     WHERE company_id=? AND entity_type='INVOICE' AND entity_id=?
     ORDER BY id DESC
     LIMIT 100`,
    [companyId, invoiceId]
  );
  return rows;
}

async function getInvoice(companyId, invoiceId) {
  const [inv] = await pool.query(
    `SELECT i.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone
     FROM invoices i
     LEFT JOIN customers c ON c.id=i.customer_id
     WHERE i.id=? AND i.company_id=? LIMIT 1`,
    [invoiceId, companyId]
  );
  const invoice = inv[0] || null;
  if (!invoice) return null;

  const [items] = await pool.query(
    "SELECT * FROM invoice_items WHERE invoice_id=? ORDER BY id ASC",
    [invoiceId]
  );

  return { invoice, items };
}

async function listInvoices(companyId) {
  const [rows] = await pool.query(
    `SELECT id, invoice_no, invoice_date, customer_id, grand_total, paid_total, due_total, status
     FROM invoices WHERE company_id=? ORDER BY id DESC`,
    [companyId]
  );
  return rows;
}
async function getByIdForUpdate(conn, companyId, invoiceId) {
  const [rows] = await conn.query(
    "SELECT * FROM invoices WHERE id=? AND company_id=? FOR UPDATE",
    [invoiceId, companyId]
  );
  return rows[0] || null;
}

async function countPayments(conn, companyId, invoiceId) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS cnt
     FROM payments p
     JOIN invoices i ON i.id=p.invoice_id
     WHERE i.company_id=? AND p.invoice_id=?`,
    [companyId, invoiceId]
  );
  return Number(rows[0]?.cnt || 0);
}

async function updateStatusFinal(conn, companyId, invoiceId, invoiceNo) {
  const [res] = await conn.query(
    `UPDATE invoices
     SET status='FINAL', invoice_no=?, finalized_at=NOW(), updated_at=NOW()
     WHERE id=? AND company_id=?`,
    [invoiceNo, invoiceId, companyId]
  );
  return res.affectedRows;
}

async function updateStatusCancelled(conn, companyId, invoiceId, reason) {
  const [res] = await conn.query(
    `UPDATE invoices
     SET status='CANCELLED', cancelled_at=NOW(), cancelled_reason=?, updated_at=NOW()
     WHERE id=? AND company_id=?`,
    [reason, invoiceId, companyId]
  );
  return res.affectedRows;
}
async function listInvoicesFiltered(companyId, q) {
  const search = (q.search || "").trim();
  const status = (q.status || "").trim();
  const from = (q.from || "").trim();
  const to = (q.to || "").trim();
  const dueOnly = String(q.due_only || "") === "1";

  const page = Math.max(1, Number(q.page || 1));
  const limit = Math.min(100, Math.max(5, Number(q.limit || 20)));
  const offset = (page - 1) * limit;

  const where = ["i.company_id=?"];
  const params = [companyId];

  if (status) {
    where.push("i.status=?");
    params.push(status);
  }

  if (from) {
    where.push("i.invoice_date >= ?");
    params.push(from);
  }

  if (to) {
    where.push("i.invoice_date <= ?");
    params.push(to);
  }

  if (dueOnly) {
    where.push("i.due_total > 0");
  }

  if (search) {
    // invoice_no can be NULL for DRAFT, so use COALESCE
    where.push("(COALESCE(i.invoice_no,'') LIKE ? OR c.name LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  // total count
  const [cntRows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM invoices i
     LEFT JOIN customers c ON c.id=i.customer_id
     ${whereSql}`,
    params
  );
  const total = Number(cntRows[0]?.total || 0);
  const pages = Math.max(1, Math.ceil(total / limit));

  // rows
  const [rows] = await pool.query(
    `SELECT
        i.id, i.invoice_no, i.invoice_date, i.due_date, i.status,
        i.grand_total, i.paid_total, i.due_total,
        i.sent_at, i.last_reminder_at, i.last_reminder_channel,
        i.customer_id,
        c.name AS customer_name
     FROM invoices i
     LEFT JOIN customers c ON c.id=i.customer_id
     ${whereSql}
     ORDER BY i.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return {
    rows,
    page,
    limit,
    total,
    pages,
  };
}


module.exports = {
  getItemById,
  createInvoiceHeader,
  insertInvoiceItem,
  nextInvoiceNumber,
  finalizeInvoice,
  getInvoice,
  listInvoices,
  getByIdForUpdate,
  countPayments,
  updateStatusFinal,
  updateStatusCancelled,
  listInvoicesFiltered,
  markInvoiceSent,
  insertReminder,
  listReminders,
  listAudit,

};




