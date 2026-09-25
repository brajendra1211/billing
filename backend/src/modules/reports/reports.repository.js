const pool = require("../../config/db");

async function getSummary(companyId, from, to) {
  // Sales/GST are FINAL-only. Outstanding due should include every open invoice.
  const [invRows] = await pool.query(
    `
    SELECT
      COUNT(*) AS final_count,
      COALESCE(SUM(grand_total),0) AS sales_total,
      COALESCE(SUM(paid_total),0) AS inv_paid_total,
      COALESCE(SUM(due_total),0) AS final_due_total,
      COALESCE(SUM(cgst_total),0) AS cgst_total,
      COALESCE(SUM(sgst_total),0) AS sgst_total,
      COALESCE(SUM(igst_total),0) AS igst_total
    FROM invoices
    WHERE company_id=?
      AND status='FINAL'
      AND invoice_date BETWEEN ? AND ?
    `,
    [companyId, from, to]
  );

  const [dueRows] = await pool.query(
    `
    SELECT
      COALESCE(SUM(due_total),0) AS due_total,
      COALESCE(SUM(CASE WHEN status='DRAFT' THEN due_total ELSE 0 END),0) AS draft_due_total,
      COALESCE(SUM(CASE WHEN status='FINAL' THEN due_total ELSE 0 END),0) AS final_due_total
    FROM invoices
    WHERE company_id=?
      AND status <> 'CANCELLED'
      AND due_total > 0
    `,
    [companyId]
  );

  const [statusRows] = await pool.query(
    `
    SELECT
      SUM(status='DRAFT') AS draft_count,
      SUM(status='FINAL') AS final_count_all,
      SUM(status='CANCELLED') AS cancelled_count
    FROM invoices
    WHERE company_id=?
      AND invoice_date BETWEEN ? AND ?
    `,
    [companyId, from, to]
  );

  const [payRows] = await pool.query(
    `
    SELECT
      COALESCE(SUM(amount),0) AS payments_received
    FROM payments p
    JOIN invoices i ON i.id=p.invoice_id
    WHERE i.company_id=?
      AND p.payment_date BETWEEN ? AND ?
    `,
    [companyId, from, to]
  );

  return {
    invoices_final: Number(invRows[0]?.final_count || 0),
    sales_total: Number(invRows[0]?.sales_total || 0),
    invoice_paid_total: Number(invRows[0]?.inv_paid_total || 0),
    due_total: Number(dueRows[0]?.due_total || 0),
    draft_due_total: Number(dueRows[0]?.draft_due_total || 0),
    final_due_total: Number(dueRows[0]?.final_due_total || invRows[0]?.final_due_total || 0),
    cgst_total: Number(invRows[0]?.cgst_total || 0),
    sgst_total: Number(invRows[0]?.sgst_total || 0),
    igst_total: Number(invRows[0]?.igst_total || 0),

    invoices_draft: Number(statusRows[0]?.draft_count || 0),
    invoices_final_all: Number(statusRows[0]?.final_count_all || 0),
    invoices_cancelled: Number(statusRows[0]?.cancelled_count || 0),

    payments_received: Number(payRows[0]?.payments_received || 0),
  };
}

async function getDailySales(companyId, from, to) {
  const [rows] = await pool.query(
    `
    SELECT
      invoice_date AS day,
      COALESCE(SUM(grand_total),0) AS sales
    FROM invoices
    WHERE company_id=?
      AND status='FINAL'
      AND invoice_date BETWEEN ? AND ?
    GROUP BY invoice_date
    ORDER BY invoice_date ASC
    `,
    [companyId, from, to]
  );
  return rows.map((r) => ({
    day: r.day,
    sales: Number(r.sales || 0),
  }));
}

async function getTopDueCustomers(companyId, limit = 10) {
  const [rows] = await pool.query(
    `
    SELECT
      c.id AS customer_id,
      c.name AS customer_name,
      COALESCE(SUM(i.due_total),0) AS due_total,
      COUNT(*) AS invoice_count
    FROM invoices i
    JOIN customers c ON c.id=i.customer_id
    WHERE i.company_id=?
      AND i.status <> 'CANCELLED'
      AND i.due_total > 0
    GROUP BY c.id, c.name
    ORDER BY due_total DESC
    LIMIT ?
    `,
    [companyId, Number(limit)]
  );
  return rows.map((r) => ({
    customer_id: r.customer_id,
    customer_name: r.customer_name,
    due_total: Number(r.due_total || 0),
    invoice_count: Number(r.invoice_count || 0),
  }));
}

async function getDueAging(companyId) {
  const [rows] = await pool.query(
    `
    SELECT
      COALESCE(SUM(CASE WHEN DATEDIFF(CURDATE(), COALESCE(due_date, invoice_date)) <= 0 THEN due_total ELSE 0 END),0) AS not_due,
      COALESCE(SUM(CASE WHEN DATEDIFF(CURDATE(), COALESCE(due_date, invoice_date)) BETWEEN 1 AND 7 THEN due_total ELSE 0 END),0) AS d_1_7,
      COALESCE(SUM(CASE WHEN DATEDIFF(CURDATE(), COALESCE(due_date, invoice_date)) BETWEEN 8 AND 30 THEN due_total ELSE 0 END),0) AS d_8_30,
      COALESCE(SUM(CASE WHEN DATEDIFF(CURDATE(), COALESCE(due_date, invoice_date)) BETWEEN 31 AND 60 THEN due_total ELSE 0 END),0) AS d_31_60,
      COALESCE(SUM(CASE WHEN DATEDIFF(CURDATE(), COALESCE(due_date, invoice_date)) > 60 THEN due_total ELSE 0 END),0) AS d_60_plus
    FROM invoices
    WHERE company_id=?
      AND status <> 'CANCELLED'
      AND due_total > 0
    `,
    [companyId]
  );

  const r = rows[0] || {};
  return {
    not_due: Number(r.not_due || 0),
    d_1_7: Number(r.d_1_7 || 0),
    d_8_30: Number(r.d_8_30 || 0),
    d_31_60: Number(r.d_31_60 || 0),
    d_60_plus: Number(r.d_60_plus || 0),
  };
}

async function getCustomerOutstanding(companyId, customerId, limit = 20) {
  const [sumRows] = await pool.query(
    `
    SELECT
      COALESCE(SUM(i.due_total),0) AS total_due,
      COUNT(*) AS invoices_count
    FROM invoices i
    WHERE i.company_id=?
      AND i.customer_id=?
      AND i.status <> 'CANCELLED'
      AND i.due_total > 0
    `,
    [companyId, customerId]
  );

  const [invRows] = await pool.query(
    `
    SELECT
      i.id, i.invoice_no, i.invoice_date, i.grand_total, i.paid_total, i.due_total, i.status
    FROM invoices i
    WHERE i.company_id=?
      AND i.customer_id=?
    ORDER BY i.id DESC
    LIMIT ?
    `,
    [companyId, customerId, Number(limit)]
  );

  return {
    total_due: Number(sumRows[0]?.total_due || 0),
    invoices_count: Number(sumRows[0]?.invoices_count || 0),
    invoices: invRows || [],
  };
}

async function getCustomerLedger(companyId, customerId, limit = 100) {
  const [customerRows] = await pool.query(
    `SELECT id, name, email, phone, gstin
     FROM customers
     WHERE company_id=? AND id=?
     LIMIT 1`,
    [companyId, customerId]
  );
  const customer = customerRows[0] || null;
  if (!customer) return null;

  const [invoiceRows] = await pool.query(
    `SELECT
       id, invoice_no, invoice_date AS entry_date, grand_total, paid_total, due_total, status
     FROM invoices
     WHERE company_id=? AND customer_id=? AND status <> 'CANCELLED'
     ORDER BY invoice_date ASC, id ASC
     LIMIT ?`,
    [companyId, customerId, Number(limit)]
  );

  const [paymentRows] = await pool.query(
    `SELECT
       p.id, p.invoice_id, p.payment_date AS entry_date, p.amount, p.mode, p.reference_no,
       i.invoice_no
     FROM payments p
     JOIN invoices i ON i.id=p.invoice_id
     WHERE p.company_id=? AND i.customer_id=?
     ORDER BY p.payment_date ASC, p.id ASC
     LIMIT ?`,
    [companyId, customerId, Number(limit)]
  );

  const entries = [
    ...invoiceRows.map((i) => ({
      type: "INVOICE",
      entry_date: i.entry_date,
      invoice_id: i.id,
      invoice_no: i.invoice_no,
      debit: Number(i.grand_total || 0),
      credit: 0,
      status: i.status,
      note: `Invoice ${i.invoice_no || `#${i.id}`}`,
    })),
    ...paymentRows.map((p) => ({
      type: "PAYMENT",
      entry_date: p.entry_date,
      invoice_id: p.invoice_id,
      invoice_no: p.invoice_no,
      debit: 0,
      credit: Number(p.amount || 0),
      status: p.mode,
      note: p.reference_no || "Payment",
    })),
  ].sort((a, b) => {
    const da = new Date(a.entry_date).getTime();
    const db = new Date(b.entry_date).getTime();
    if (da !== db) return da - db;
    return a.type === "INVOICE" ? -1 : 1;
  });

  let balance = 0;
  const ledger = entries.map((e) => {
    balance += Number(e.debit || 0) - Number(e.credit || 0);
    return { ...e, balance };
  });

  const totals = ledger.reduce(
    (acc, e) => {
      acc.debit += Number(e.debit || 0);
      acc.credit += Number(e.credit || 0);
      acc.balance = e.balance;
      return acc;
    },
    { debit: 0, credit: 0, balance: 0 }
  );

  return { customer, totals, ledger };
}
async function listCustomers(companyId, search = "") {
  const s = String(search || "").trim();
  const where = ["company_id=?"];
  const params = [companyId];

  if (s) {
    where.push("name LIKE ?");
    params.push(`%${s}%`);
  }

  const [rows] = await pool.query(
    `SELECT id, name
     FROM customers
     WHERE ${where.join(" AND ")}
     ORDER BY name ASC
     LIMIT 200`,
    params
  );
  return rows || [];
}
async function getProfit(companyId, from, to) {
  const [rows] = await pool.query(
    `
    SELECT
      COALESCE(SUM(ii.taxable_amount),0) AS gross_sales,
      COALESCE(SUM(ii.qty * it.cost_price),0) AS total_cost,
      COALESCE(SUM(ii.taxable_amount - (ii.qty * it.cost_price)),0) AS gross_profit
    FROM invoice_items ii
    JOIN invoices i ON i.id = ii.invoice_id
    JOIN items it ON it.id = ii.item_id
    WHERE i.company_id=?
      AND i.status='FINAL'
      AND i.invoice_date BETWEEN ? AND ?
    `,
    [companyId, from, to]
  );

  return {
    gross_sales: Number(rows[0]?.gross_sales || 0),
    total_cost: Number(rows[0]?.total_cost || 0),
    gross_profit: Number(rows[0]?.gross_profit || 0),
  };
}

module.exports = {
  getSummary,
  getDailySales,
  getTopDueCustomers,
  getDueAging,
  getCustomerOutstanding,
  getCustomerLedger,
  listCustomers, 
  getProfit, // ✅ add this
};

