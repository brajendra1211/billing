const pool = require("../../config/db");
const tokens = require("./portal.tokens");
const pdfService = require("../pdf/pdf.service");
const reportsRepo = require("../reports/reports.repository");
const onlinePayments = require("../onlinePayments/onlinePayments.service");
const razorpay = require("../../utils/razorpay");
const { isValidUpiId } = require("../../utils/upi");

function notFound() {
  const err = new Error("Link invalid ya expire ho gaya hai");
  err.statusCode = 404;
  return err;
}

async function resolve(token) {
  const who = await tokens.resolveToken(token);
  if (!who) throw notFound();
  return who;
}

// The customer only sees invoices that were actually issued/sent to them
const VISIBLE = "status <> 'CANCELLED' AND (status='FINAL' OR sent_at IS NOT NULL)";

async function visibleInvoice(who, invoiceId) {
  const [[inv]] = await pool.query(
    `SELECT id FROM invoices WHERE id=? AND company_id=? AND customer_id=? AND ${VISIBLE}`,
    [invoiceId, who.companyId, who.customerId]
  );
  if (!inv) throw notFound();
  return inv;
}

async function overview(token) {
  const who = await resolve(token);

  const [[company]] = await pool.query(
    `SELECT name, legal_name, gstin, email, phone, upi_id, logo_url,
            billing_address_line1, billing_address_line2, billing_city, billing_state, billing_pincode
     FROM companies WHERE id=?`,
    [who.companyId]
  );
  const [[customer]] = await pool.query(
    "SELECT name, contact_person, email, phone, gstin FROM customers WHERE id=?",
    [who.customerId]
  );
  const [invoices] = await pool.query(
    `SELECT id, invoice_no, invoice_date, due_date, status,
            grand_total, paid_total, credit_total, due_total
     FROM invoices
     WHERE company_id=? AND customer_id=? AND ${VISIBLE}
     ORDER BY invoice_date DESC, id DESC
     LIMIT 200`,
    [who.companyId, who.customerId]
  );

  const visibleIds = new Set(invoices.map((i) => Number(i.id)));
  const ledgerData = await reportsRepo.getCustomerLedger(who.companyId, who.customerId, 500);
  // Recompute running balance over only what the customer can see
  let balance = 0;
  const ledger = (ledgerData?.ledger || [])
    .filter((e) => visibleIds.has(Number(e.invoice_id)))
    .map((e) => {
      balance += Number(e.debit || 0) - Number(e.credit || 0);
      return { type: e.type, entry_date: e.entry_date, invoice_no: e.invoice_no, debit: e.debit, credit: e.credit, note: e.note, balance: Math.round(balance * 100) / 100 };
    });

  const totalDue = invoices.reduce((s, i) => s + Number(i.due_total || 0), 0);

  return {
    company: {
      ...company,
      logo_url: company.logo_url || null,
      upi_id: isValidUpiId(company.upi_id) ? company.upi_id : null,
    },
    customer,
    invoices,
    ledger,
    total_due: Math.round(totalDue * 100) / 100,
    online_payment: razorpay.isConfigured(),
  };
}

async function invoicePdf(token, invoiceId) {
  const who = await resolve(token);
  await visibleInvoice(who, invoiceId);
  return pdfService.generateInvoicePdf(who.companyId, invoiceId);
}

async function pay(token, invoiceId) {
  const who = await resolve(token);
  await visibleInvoice(who, invoiceId);
  const link = await onlinePayments.getOrCreateLink({ companyId: who.companyId, invoiceId });
  return { url: link.short_url, amount: Number(link.amount) };
}

/** Called when Razorpay redirects the customer back to the portal */
async function sync(token, invoiceId) {
  const who = await resolve(token);
  await visibleInvoice(who, invoiceId);
  if (razorpay.isConfigured()) await onlinePayments.syncInvoice(who.companyId, invoiceId);
  const [[inv]] = await pool.query("SELECT id, invoice_no, due_total, status FROM invoices WHERE id=?", [invoiceId]);
  return { ...inv, paid: Number(inv.due_total) <= 0 };
}

/* ----- staff side ----- */

async function staffLink(companyId, customerId) {
  const token = await tokens.getOrCreateToken(companyId, customerId);
  return { url: tokens.portalUrl(token), public_url_configured: tokens.isPublicUrlConfigured() };
}

async function staffRegenerate(companyId, customerId) {
  const token = await tokens.regenerateToken(companyId, customerId);
  return { url: tokens.portalUrl(token), public_url_configured: tokens.isPublicUrlConfigured() };
}

module.exports = { overview, invoicePdf, pay, sync, staffLink, staffRegenerate };
