const pool = require("../../config/db");
const razorpay = require("../../utils/razorpay");
const pdfService = require("../pdf/pdf.service");
const paymentsService = require("../payments/payments.service");
const portalTokens = require("../portal/portal.tokens");
const { writeAudit } = require("../../utils/audit");

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function httpError(status, message) {
  const err = new Error(message);
  err.statusCode = status;
  return err;
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const METHOD_TO_MODE = { upi: "UPI", card: "CARD", netbanking: "BANK_TRANSFER", emi: "CARD" };

function toContact(phone) {
  let d = String(phone || "").replace(/\D/g, "").replace(/^0+/, "");
  if (d.length === 10) d = `91${d}`;
  return d.length >= 11 ? `+${d}` : undefined;
}

async function listForInvoice(companyId, invoiceId) {
  const [rows] = await pool.query(
    "SELECT * FROM payment_links WHERE company_id=? AND invoice_id=? ORDER BY id DESC",
    [companyId, invoiceId]
  );
  return rows;
}

/**
 * Returns an open Razorpay link for the invoice's current due amount,
 * reusing the last one when the amount hasn't changed.
 */
async function getOrCreateLink({ companyId, invoiceId, userId = null }) {
  if (!razorpay.isConfigured()) {
    throw httpError(400, "Online payment (Razorpay) configured nahi hai. backend/.env mein RAZORPAY_KEY_ID aur RAZORPAY_KEY_SECRET set karein.");
  }
  const data = await pdfService.getCompanyCustomerInvoice(companyId, invoiceId);
  if (!data) throw httpError(404, "Invoice not found");
  const { invoice, customer, company } = data;
  if (invoice.status === "CANCELLED") throw httpError(400, "Cancelled invoice");

  const due = round2(invoice.due_total);
  if (!(due > 0)) throw httpError(400, "Is invoice pe koi amount baaki nahi hai");
  if (due < 1) throw httpError(400, "Online payment ke liye kam se kam ₹1 hona chahiye");

  const [[open]] = await pool.query(
    "SELECT * FROM payment_links WHERE company_id=? AND invoice_id=? AND status='CREATED' ORDER BY id DESC LIMIT 1",
    [companyId, invoiceId]
  );
  if (open && round2(open.amount) === due) return open;
  if (open) {
    // Amount changed (partial payment / credit note): retire the old link
    await razorpay.cancelPaymentLink(open.provider_link_id).catch((e) => console.warn("cancel link:", e.message));
    await pool.query("UPDATE payment_links SET status='CANCELLED' WHERE id=?", [open.id]);
  }

  const token = await portalTokens.getOrCreateToken(companyId, invoice.customer_id);
  const label = invoice.invoice_no || `Draft #${invoice.id}`;
  const link = await razorpay.createPaymentLink({
    amount: due,
    description: `Invoice ${label} - ${company.name}`,
    referenceId: `INV${invoice.id}-${Date.now().toString(36)}`,
    customer: {
      name: String(customer.name || "").slice(0, 100),
      ...(customer.email ? { email: customer.email } : {}),
      ...(toContact(customer.phone) ? { contact: toContact(customer.phone) } : {}),
    },
    callbackUrl: `${portalTokens.portalUrl(token)}?paid=${invoice.id}`,
    notes: { invoice_id: String(invoice.id), company_id: String(companyId) },
  });

  const [ins] = await pool.query(
    `INSERT INTO payment_links (company_id, invoice_id, provider, provider_link_id, short_url, amount, status, created_by)
     VALUES (?,?, 'RAZORPAY', ?,?,?, 'CREATED', ?)`,
    [companyId, invoiceId, link.id, link.short_url, due, userId]
  );
  const [[row]] = await pool.query("SELECT * FROM payment_links WHERE id=?", [ins.insertId]);
  return row;
}

/** Records the gateway payment against the invoice exactly once. */
async function recordLinkPaid(linkId, { providerPaymentId, amountPaise, method }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[link]] = await conn.query("SELECT * FROM payment_links WHERE id=? FOR UPDATE", [linkId]);
    if (!link || link.status === "PAID") {
      await conn.commit();
      return { recorded: false };
    }

    const [[dup]] = await conn.query("SELECT id FROM payments WHERE gateway_payment_id=?", [providerPaymentId]);
    let paymentId = dup?.id || null;
    if (!paymentId) {
      const out = await paymentsService.applyPayment(conn, {
        companyId: link.company_id,
        userId: null,
        invoiceId: link.invoice_id,
        payload: {
          payment_date: todayISO(),
          amount: round2(Number(amountPaise) / 100),
          mode: METHOD_TO_MODE[String(method || "").toLowerCase()] || "OTHER",
          reference_no: `Razorpay ${providerPaymentId}`,
          notes: "Online payment (payment link)",
        },
        allowOverpay: true,
        gatewayPaymentId: providerPaymentId,
      });
      paymentId = out.paymentId;
    }

    await conn.query(
      "UPDATE payment_links SET status='PAID', provider_payment_id=?, payment_id=? WHERE id=?",
      [providerPaymentId, paymentId, link.id]
    );
    await writeAudit(conn, {
      companyId: link.company_id,
      userId: null,
      entityType: "INVOICE",
      entityId: link.invoice_id,
      action: "ONLINE_PAYMENT",
      newValues: { provider_payment_id: providerPaymentId, amount: Number(amountPaise) / 100, payment_id: paymentId },
    });
    await conn.commit();
    return { recorded: !dup, paymentId };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/** Ask Razorpay for the link's status (used when webhooks can't reach us) */
async function syncLink(link) {
  const remote = await razorpay.fetchPaymentLink(link.provider_link_id);
  const status = String(remote.status || "").toLowerCase();

  if (status === "paid") {
    const p = (remote.payments || []).find((x) => String(x.status || "").toLowerCase() === "captured") || (remote.payments || [])[0];
    if (!p) return "pending";
    await recordLinkPaid(link.id, { providerPaymentId: p.payment_id, amountPaise: p.amount, method: p.method });
    return "paid";
  }
  if (status === "cancelled" || status === "expired") {
    await pool.query("UPDATE payment_links SET status=? WHERE id=? AND status='CREATED'", [status.toUpperCase(), link.id]);
    return status;
  }
  return "pending";
}

async function syncInvoice(companyId, invoiceId) {
  const [links] = await pool.query(
    "SELECT * FROM payment_links WHERE company_id=? AND invoice_id=? AND status='CREATED'",
    [companyId, invoiceId]
  );
  const results = [];
  for (const l of links) results.push(await syncLink(l));
  return results;
}

/** Scheduler: check every open link from the last 60 days */
async function syncAllOpen() {
  if (!razorpay.isConfigured()) return { skipped: "razorpay not configured" };
  const [links] = await pool.query(
    "SELECT * FROM payment_links WHERE status='CREATED' AND created_at >= DATE_SUB(NOW(), INTERVAL 60 DAY)"
  );
  const out = { checked: links.length, paid: 0, failed: 0 };
  for (const l of links) {
    try {
      if ((await syncLink(l)) === "paid") out.paid++;
    } catch (e) {
      out.failed++;
      console.warn(`[payment-links] sync ${l.provider_link_id} failed:`, e.message);
    }
  }
  return out;
}

/** Razorpay webhook: payment_link.paid */
async function handleWebhook(rawBody, signature) {
  if (!razorpay.verifyWebhookSignature(rawBody, signature)) throw httpError(400, "Invalid signature");
  const event = JSON.parse(rawBody.toString("utf-8"));
  if (event.event !== "payment_link.paid") return { ignored: event.event };

  const linkEntity = event.payload?.payment_link?.entity;
  const payment = event.payload?.payment?.entity;
  if (!linkEntity?.id || !payment?.id) return { ignored: "missing entities" };

  const [[link]] = await pool.query(
    "SELECT id FROM payment_links WHERE provider='RAZORPAY' AND provider_link_id=?",
    [linkEntity.id]
  );
  if (!link) return { ignored: "unknown link" };

  return recordLinkPaid(link.id, { providerPaymentId: payment.id, amountPaise: payment.amount, method: payment.method });
}

/** After an invoice is fully paid another way, stop old links from taking more money */
async function cancelOpenLinks(companyId, invoiceId) {
  const [links] = await pool.query(
    "SELECT * FROM payment_links WHERE company_id=? AND invoice_id=? AND status='CREATED'",
    [companyId, invoiceId]
  );
  for (const l of links) {
    try {
      await razorpay.cancelPaymentLink(l.provider_link_id);
      await pool.query("UPDATE payment_links SET status='CANCELLED' WHERE id=?", [l.id]);
    } catch (e) {
      console.warn(`[payment-links] cancel ${l.provider_link_id} failed:`, e.message);
    }
  }
}

module.exports = {
  listForInvoice,
  getOrCreateLink,
  recordLinkPaid,
  syncLink,
  syncInvoice,
  syncAllOpen,
  handleWebhook,
  cancelOpenLinks,
};
