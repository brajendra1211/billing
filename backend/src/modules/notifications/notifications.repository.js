const pool = require("../../config/db");

const DEFAULT_SETTINGS = {
  auto_reminders: 0,
  reminder_days: "3,7,15",
  renewal_alerts: 0,
  renewal_auto_invoice: 0,
  renewal_invoice_days_before: 7,
};

async function getSettings(companyId) {
  const [rows] = await pool.query(
    "SELECT * FROM notification_settings WHERE company_id=? LIMIT 1",
    [companyId]
  );
  return { ...DEFAULT_SETTINGS, ...(rows[0] || {}), company_id: companyId };
}

async function saveSettings(companyId, s) {
  await pool.query(
    `INSERT INTO notification_settings
       (company_id, auto_reminders, reminder_days, renewal_alerts, renewal_auto_invoice, renewal_invoice_days_before)
     VALUES (?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE
       auto_reminders=VALUES(auto_reminders),
       reminder_days=VALUES(reminder_days),
       renewal_alerts=VALUES(renewal_alerts),
       renewal_auto_invoice=VALUES(renewal_auto_invoice),
       renewal_invoice_days_before=VALUES(renewal_invoice_days_before)`,
    [
      companyId,
      s.auto_reminders,
      s.reminder_days,
      s.renewal_alerts,
      s.renewal_auto_invoice,
      s.renewal_invoice_days_before,
    ]
  );
}

/** Companies that have at least one automatic feature switched on */
async function listEnabledCompanies() {
  const [rows] = await pool.query(
    `SELECT company_id FROM notification_settings
     WHERE auto_reminders=1 OR renewal_alerts=1 OR renewal_auto_invoice=1`
  );
  return rows.map((r) => Number(r.company_id));
}

/**
 * Reserve a (company, kind, entity, ref_key) slot. Returns the log id,
 * or null when the same action already happened (unique key hit).
 */
async function claim({ companyId, kind, entityType, entityId, refKey, channel = "EMAIL" }) {
  const [r] = await pool.query(
    `INSERT IGNORE INTO notification_log (company_id, kind, entity_type, entity_id, ref_key, channel, status)
     VALUES (?,?,?,?,?,?,'PENDING')`,
    [companyId, kind, entityType, entityId, refKey, channel]
  );
  return r.affectedRows ? r.insertId : null;
}

async function markSent(id, recipient, status = "SENT") {
  await pool.query(
    "UPDATE notification_log SET status=?, recipient=?, error=NULL WHERE id=?",
    [status, recipient ? String(recipient).slice(0, 255) : null, id]
  );
}

/** Keep the failure for history but free the unique slot so the next run retries. */
async function markFailed(id, error) {
  await pool.query(
    `UPDATE notification_log
     SET status='FAILED', error=?, ref_key=CONCAT(LEFT(ref_key, 60), '#failed-', id)
     WHERE id=?`,
    [String(error || "").slice(0, 500), id]
  );
}

async function listLog(companyId, limit = 100) {
  const [rows] = await pool.query(
    `SELECT l.*, i.invoice_no, r.name AS renewal_name
     FROM notification_log l
     LEFT JOIN invoices i ON l.entity_type='INVOICE' AND i.id=l.entity_id
     LEFT JOIN recurring_expenses r ON l.entity_type='RENEWAL' AND r.id=l.entity_id
     WHERE l.company_id=?
     ORDER BY l.id DESC
     LIMIT ?`,
    [companyId, Number(limit)]
  );
  return rows;
}

async function getCompany(companyId) {
  const [rows] = await pool.query("SELECT * FROM companies WHERE id=? LIMIT 1", [companyId]);
  return rows[0] || null;
}

/** Unpaid invoices that were sent to the customer and are at least `minDays` past due */
async function listOverdueInvoices(companyId, minDays) {
  const [rows] = await pool.query(
    `SELECT i.id, i.invoice_no, i.due_total,
            COALESCE(i.due_date, i.invoice_date) AS due_on,
            DATEDIFF(CURDATE(), COALESCE(i.due_date, i.invoice_date)) AS days_overdue,
            c.email AS customer_email
     FROM invoices i
     JOIN customers c ON c.id=i.customer_id
     WHERE i.company_id=?
       AND i.status <> 'CANCELLED'
       AND i.due_total > 0
       AND i.sent_at IS NOT NULL
       AND DATEDIFF(CURDATE(), COALESCE(i.due_date, i.invoice_date)) >= ?`,
    [companyId, minDays]
  );
  return rows;
}

/** Active renewals due within `withinDays` (and ones already overdue) */
async function listUpcomingRenewals(companyId, withinDays) {
  const [rows] = await pool.query(
    `SELECT r.*, DATEDIFF(r.next_due_date, CURDATE()) AS days_left,
            c.name AS customer_name, c.email AS customer_email,
            li.id AS last_inv_id, li.due_date AS last_inv_due_date, li.status AS last_inv_status
     FROM recurring_expenses r
     LEFT JOIN customers c ON c.id=r.customer_id
     LEFT JOIN invoices li ON li.id=r.last_invoice_id AND li.company_id=r.company_id
     WHERE r.company_id=? AND r.is_active=1
       AND DATEDIFF(r.next_due_date, CURDATE()) <= GREATEST(COALESCE(r.remind_before_days, 7), ?)`,
    [companyId, withinDays]
  );
  return rows;
}

module.exports = {
  getSettings,
  saveSettings,
  listEnabledCompanies,
  claim,
  markSent,
  markFailed,
  listLog,
  getCompany,
  listOverdueInvoices,
  listUpcomingRenewals,
};
