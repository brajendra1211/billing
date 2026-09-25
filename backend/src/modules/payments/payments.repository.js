const pool = require("../../config/db");

// 1) invoice header (for validating invoice + totals) ✅ now FOR UPDATE lock
async function getInvoiceForPayment(conn, companyId, invoiceId) {
  const [rows] = await conn.query(
    `SELECT id, company_id, status, grand_total, paid_total, due_total,
            invoice_no, financial_year, invoice_date
     FROM invoices
     WHERE company_id = ? AND id = ?
     FOR UPDATE`,
    [companyId, invoiceId]
  );
  return rows[0] || null;
}

// 2) list payments for invoice
async function listByInvoice(companyId, invoiceId) {
  const [rows] = await pool.query(
    `SELECT id, invoice_id, payment_date, amount, mode, reference_no, notes, created_at
     FROM payments
     WHERE company_id = ? AND invoice_id = ?
     ORDER BY id DESC`,
    [companyId, invoiceId]
  );
  return rows;
}

// 3) insert payment (transaction connection)
async function insertPayment(conn, row) {
  const [r] = await conn.query(
    `INSERT INTO payments
     (company_id, invoice_id, payment_date, amount, mode, reference_no, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.company_id,
      row.invoice_id,
      row.payment_date,
      row.amount,
      row.mode,
      row.reference_no,
      row.notes,
      row.created_by,
    ]
  );
  return r.insertId;
}

// 4) sum payments for invoice (transaction connection)
async function sumPaymentsForInvoice(conn, companyId, invoiceId) {
  const [rows] = await conn.query(
    `SELECT COALESCE(SUM(amount), 0) AS paid_total
     FROM payments
     WHERE company_id = ? AND invoice_id = ?`,
    [companyId, invoiceId]
  );
  return rows[0] || { paid_total: 0 };
}

// 5) update invoice paid/due (transaction connection)
async function updateInvoicePaidDue(conn, { companyId, invoiceId, paid_total, due_total, updated_by }) {
  const [r] = await conn.query(
    `UPDATE invoices
     SET paid_total = ?, due_total = ?, updated_by = ?, updated_at = NOW()
     WHERE company_id = ? AND id = ?`,
    [paid_total, due_total, updated_by, companyId, invoiceId]
  );
  return r.affectedRows;
}

async function updateInvoiceStatus(conn, { companyId, invoiceId, status, updated_by }) {
  const [r] = await conn.query(
    `UPDATE invoices
     SET status=?, updated_by=?, updated_at=NOW()
     WHERE id=? AND company_id=?`,
    [status, updated_by, invoiceId, companyId]
  );
  return r.affectedRows;
}

module.exports = {
  getInvoiceForPayment,
  listByInvoice,
  insertPayment,
  sumPaymentsForInvoice,
  updateInvoicePaidDue,
  updateInvoiceStatus,
};
