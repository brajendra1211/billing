const pool = require("../../config/db");
const repo = require("./notifications.repository");
const tpl = require("./notifications.templates");
const pdfService = require("../pdf/pdf.service");
const invoicesRepo = require("../invoices/invoices.repository");
const renewalsService = require("../renewals/renewals.service");
const { sendMail, isMailConfigured } = require("../../utils/mailer");
const { isValidUpiId } = require("../../utils/upi");
const { writeAudit } = require("../../utils/audit");
const portalTokens = require("../portal/portal.tokens");

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function httpError(status, message) {
  const err = new Error(message);
  err.statusCode = status;
  return err;
}

function parseReminderDays(str) {
  return [...new Set(
    String(str || "")
      .split(",")
      .map((x) => Number(x.trim()))
      .filter((n) => Number.isInteger(n) && n >= 0 && n <= 365)
  )].sort((a, b) => a - b);
}

function pdfFileName(invoice) {
  return `Invoice-${String(tpl.invoiceLabel(invoice)).replace(/[^\w.-]+/g, "_")}.pdf`;
}

/** Run `fn` at most once per (company, kind, entity, refKey); records the outcome in notification_log. */
async function once(key, fn) {
  const logId = await repo.claim(key);
  if (!logId) return "skipped";
  try {
    const recipient = await fn();
    await repo.markSent(logId, recipient, recipient === null ? "SKIPPED" : "SENT");
    return recipient === null ? "skipped" : "sent";
  } catch (e) {
    await repo.markFailed(logId, e.message);
    console.warn(`[notifications] ${key.kind} #${key.entityId} failed:`, e.message);
    return "failed";
  }
}

/* ---------------- Invoice email / WhatsApp ---------------- */

/** Customer portal link, only when the app has a public URL (localhost links are useless to customers) */
async function customerPortalUrl(companyId, customerId) {
  if (!portalTokens.isPublicUrlConfigured() || !customerId) return null;
  const token = await portalTokens.getOrCreateToken(companyId, customerId);
  return portalTokens.portalUrl(token);
}

async function loadInvoiceBundle(companyId, invoiceId) {
  const data = await pdfService.getCompanyCustomerInvoice(companyId, invoiceId);
  if (!data) throw httpError(404, "Invoice not found");
  if (String(data.invoice.status).toUpperCase() === "CANCELLED") {
    throw httpError(400, "Cancelled invoice cannot be sent");
  }
  return data;
}

async function emailInvoice({ companyId, invoiceId, to, cc, message, isReminder = false, daysOverdue = 0 }) {
  const data = await loadInvoiceBundle(companyId, invoiceId);
  const recipient = String(to || data.customer.email || "").trim();
  if (!recipient) throw httpError(400, "Customer ki email nahi hai. Customer mein email add karein.");

  const { pdf } = await pdfService.generateInvoicePdf(companyId, invoiceId);
  const portalUrl = await customerPortalUrl(companyId, data.invoice.customer_id);
  const mail = isReminder
    ? tpl.reminderEmail({ ...data, daysOverdue, portalUrl })
    : tpl.invoiceEmail({ ...data, message, portalUrl });

  await sendMail({
    fromName: data.company.name,
    to: recipient,
    cc: cc || undefined,
    replyTo: data.company.email || undefined,
    subject: mail.subject,
    html: mail.html,
    attachments: [{ filename: pdfFileName(data.invoice), content: Buffer.from(pdf) }],
  });

  return { recipient, invoice: data.invoice };
}

/** Manual "Send by email" from the invoice page */
async function sendInvoiceEmail({ companyId, userId, invoiceId, to, cc, message }) {
  const logId = await repo.claim({
    companyId,
    kind: "INVOICE_EMAIL",
    entityType: "INVOICE",
    entityId: invoiceId,
    refKey: `manual-${Date.now()}`,
  });

  try {
    const { recipient } = await emailInvoice({ companyId, invoiceId, to, cc, message });
    await repo.markSent(logId, recipient);
    await invoicesRepo.markInvoiceSent(pool, companyId, invoiceId, "EMAIL");
    await writeAudit(pool, {
      companyId,
      userId,
      entityType: "INVOICE",
      entityId: invoiceId,
      action: "EMAIL_SENT",
      newValues: { to: recipient, cc: cc || null },
    });
    return { sent: true, to: recipient };
  } catch (e) {
    await repo.markFailed(logId, e.message);
    throw e;
  }
}

function normalizeIndianPhone(phone) {
  let digits = String(phone || "").replace(/\D/g, "");
  if (digits.startsWith("0")) digits = digits.replace(/^0+/, "");
  if (digits.length === 10) digits = `91${digits}`;
  return digits.length >= 11 ? digits : "";
}

/** Builds a wa.me link with the invoice summary; the user attaches the PDF in WhatsApp. */
async function whatsappLink({ companyId, invoiceId, phone }) {
  const data = await loadInvoiceBundle(companyId, invoiceId);
  const number = normalizeIndianPhone(phone || data.customer.phone);
  const portalUrl = await customerPortalUrl(companyId, data.invoice.customer_id);
  const text = tpl.invoiceWhatsappText({ ...data, portalUrl });
  const url = `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
  return { url, phone: number || null, text };
}

/* ---------------- Automatic jobs ---------------- */

async function runInvoiceReminders(companyId, settings) {
  const out = { sent: 0, skipped: 0, failed: 0 };
  const days = parseReminderDays(settings.reminder_days);
  if (!days.length) return out;

  const invoices = await repo.listOverdueInvoices(companyId, days[0]);
  for (const inv of invoices) {
    // Highest threshold reached; each threshold is sent once per invoice
    const threshold = days.filter((d) => d <= Number(inv.days_overdue)).pop();
    if (threshold === undefined) continue;

    const result = await once(
      { companyId, kind: "INVOICE_REMINDER", entityType: "INVOICE", entityId: inv.id, refKey: `overdue-${threshold}` },
      async () => {
        if (!inv.customer_email) return null; // nothing to send to -> SKIPPED
        const { recipient } = await emailInvoice({
          companyId,
          invoiceId: inv.id,
          isReminder: true,
          daysOverdue: Number(inv.days_overdue),
        });
        await invoicesRepo.insertReminder(pool, {
          companyId,
          invoiceId: inv.id,
          userId: null,
          reminderDate: todayISO(),
          channel: "EMAIL",
          note: `Auto reminder (${threshold} days overdue)`,
        });
        return recipient;
      }
    );
    out[result]++;
  }
  return out;
}

async function runRenewals(companyId, settings) {
  const out = { invoices_created: 0, alerts_sent: 0, skipped: 0, failed: 0 };
  const invoiceDays = Number(settings.renewal_invoice_days_before || 0);
  const renewals = await repo.listUpcomingRenewals(companyId, settings.renewal_auto_invoice ? invoiceDays : 0);

  for (const r of renewals) {
    const due = String(r.next_due_date).slice(0, 10);
    let invoiceId =
      r.last_inv_id && String(r.last_inv_due_date || "").slice(0, 10) === due && r.last_inv_status !== "CANCELLED"
        ? Number(r.last_inv_id)
        : null;

    // 1) Auto-create a DRAFT invoice for this cycle
    if (settings.renewal_auto_invoice && !invoiceId && r.customer_id && Number(r.days_left) <= invoiceDays) {
      const result = await once(
        { companyId, kind: "RENEWAL_INVOICE", entityType: "RENEWAL", entityId: r.id, refKey: `due-${due}`, channel: "SYSTEM" },
        async () => {
          const created = await renewalsService.createInvoiceFromRenewal({
            companyId,
            userId: null,
            recurringId: r.id,
            body: { invoice_date: todayISO(), due_date: due },
          });
          invoiceId = Number(created.invoiceId);
          return `invoice #${invoiceId}`;
        }
      );
      if (result === "sent") out.invoices_created++;
      else if (result === "failed") out.failed++;
    }

    // 2) Expiry alert email (to customer, company in BCC)
    const inAlertWindow = Number(r.days_left) <= Number(r.remind_before_days ?? 7);
    if (settings.renewal_alerts && inAlertWindow) {
      const expired = Number(r.days_left) < 0;
      const result = await once(
        { companyId, kind: "RENEWAL_ALERT", entityType: "RENEWAL", entityId: r.id, refKey: `${expired ? "expired" : "due"}-${due}` },
        async () => {
          const company = await repo.getCompany(companyId);
          const to = r.customer_email || company.email;
          if (!to) return null;

          let invoice = null;
          const attachments = [];
          if (invoiceId) {
            const data = await pdfService.getCompanyCustomerInvoice(companyId, invoiceId);
            if (data) {
              invoice = data.invoice;
              const { pdf } = await pdfService.generateInvoicePdf(companyId, invoiceId);
              attachments.push({ filename: pdfFileName(invoice), content: Buffer.from(pdf) });
            }
          }

          const portalUrl = await customerPortalUrl(companyId, r.customer_id);
          const mail = tpl.renewalAlertEmail({ company, renewal: r, invoice, portalUrl });
          await sendMail({
            fromName: company.name,
            to,
            bcc: r.customer_email && company.email ? company.email : undefined,
            replyTo: company.email || undefined,
            subject: mail.subject,
            html: mail.html,
            attachments,
          });
          if (invoice && r.customer_email) {
            await invoicesRepo.markInvoiceSent(pool, companyId, invoice.id, "EMAIL");
          }
          return to;
        }
      );
      if (result === "sent") out.alerts_sent++;
      else out[result]++;
    }
  }
  return out;
}

async function runForCompany(companyId) {
  const settings = await repo.getSettings(companyId);
  const summary = { company_id: companyId, reminders: null, renewals: null, notes: [] };
  const mailOk = isMailConfigured();
  if (!mailOk) summary.notes.push("SMTP not configured: emails skipped");

  if (settings.auto_reminders && mailOk) {
    summary.reminders = await runInvoiceReminders(companyId, settings);
  }
  if (settings.renewal_auto_invoice || (settings.renewal_alerts && mailOk)) {
    summary.renewals = await runRenewals(companyId, { ...settings, renewal_alerts: settings.renewal_alerts && mailOk });
  }
  if (settings.milestone_auto_invoice || (settings.milestone_demands && mailOk)) {
    // required lazily: paymentPlans -> notifications.repository, avoid a load-order cycle
    const paymentPlans = require("../paymentPlans/paymentPlans.service");
    summary.milestones = await paymentPlans.runMilestoneAutomation(companyId, settings, { mailOk });
  }
  return summary;
}

async function runDailyJobs() {
  const results = [];
  for (const companyId of await repo.listEnabledCompanies()) {
    try {
      results.push(await runForCompany(companyId));
    } catch (e) {
      console.error(`[notifications] company ${companyId} failed:`, e);
      results.push({ company_id: companyId, error: e.message });
    }
  }
  return results;
}

/* ---------------- Settings / status ---------------- */

async function getSettings(companyId) {
  return repo.getSettings(companyId);
}

async function saveSettings(companyId, body) {
  const days = parseReminderDays(body.reminder_days);
  if (body.auto_reminders && !days.length) throw httpError(400, "Reminder days required, e.g. 3,7,15");
  await repo.saveSettings(companyId, { ...body, reminder_days: days.join(",") || "3,7,15" });
  return repo.getSettings(companyId);
}

async function status(companyId) {
  const company = await repo.getCompany(companyId);
  return {
    smtp_configured: isMailConfigured(),
    mail_from: process.env.MAIL_FROM || process.env.SMTP_USER || null,
    company_email: company?.email || null,
    upi_id: company?.upi_id || null,
    upi_valid: isValidUpiId(company?.upi_id),
  };
}

async function sendTestEmail(companyId, to) {
  const company = await repo.getCompany(companyId);
  const recipient = to || company?.email;
  if (!recipient) throw httpError(400, "Recipient email required");
  await sendMail({
    fromName: company?.name,
    to: recipient,
    subject: "Test email from Urgent Billing",
    html: `<p>Email setup is working ✅</p><p>${company?.name || ""}</p>`,
  });
  return { sent: true, to: recipient };
}

module.exports = {
  sendInvoiceEmail,
  whatsappLink,
  runForCompany,
  runDailyJobs,
  getSettings,
  saveSettings,
  status,
  sendTestEmail,
  listLog: repo.listLog,
  // exported for tests
  parseReminderDays,
  normalizeIndianPhone,
};
