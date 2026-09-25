// Plain inline-styled emails (email clients ignore <style> blocks).

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(n) {
  return `₹ ${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d) {
  if (!d) return "-";
  const dt = new Date(String(d).slice(0, 10) + "T00:00:00");
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function invoiceLabel(invoice) {
  return invoice.invoice_no || `Draft #${invoice.id}`;
}

function layout(company, bodyHtml) {
  const contact = [company.phone, company.email].filter(Boolean).map(esc).join(" &nbsp;|&nbsp; ");
  return `
<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111;max-width:600px;margin:0 auto;">
  <div style="padding:16px 0;border-bottom:2px solid #111;">
    <div style="font-size:18px;font-weight:bold;">${esc(company.name)}</div>
    ${contact ? `<div style="font-size:12px;color:#555;margin-top:4px;">${contact}</div>` : ""}
  </div>
  <div style="padding:16px 0;line-height:1.55;">${bodyHtml}</div>
  <div style="border-top:1px solid #ddd;padding-top:10px;font-size:12px;color:#777;">
    This is an automated message from ${esc(company.name)}.
  </div>
</div>`;
}

function paymentBlock(company, amount) {
  const rows = [];
  if (company.upi_id) rows.push(`<div>UPI: <b>${esc(company.upi_id)}</b></div>`);
  if (company.bank_account_no) {
    rows.push(
      `<div>Bank: <b>${esc(company.bank_name || "")}</b>, A/C <b>${esc(company.bank_account_no)}</b>, IFSC <b>${esc(company.bank_ifsc || "")}</b></div>`
    );
  }
  if (!rows.length) return "";
  return `
  <div style="background:#f6f6f6;border-radius:8px;padding:12px;margin:14px 0;">
    <div style="font-weight:bold;margin-bottom:6px;">Payment details${Number(amount) > 0 ? ` — ${money(amount)}` : ""}</div>
    ${rows.join("")}
    <div style="font-size:12px;color:#666;margin-top:6px;">The attached invoice has a UPI QR code you can scan to pay.</div>
  </div>`;
}

function portalButton(portalUrl, label = "View invoice & pay online") {
  if (!portalUrl) return "";
  return `
  <p style="margin:18px 0;">
    <a href="${esc(portalUrl)}" style="background:#111;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;display:inline-block;font-weight:bold;">${esc(label)}</a>
  </p>`;
}

function invoiceEmail({ company, customer, invoice, message, portalUrl }) {
  const subject = `Invoice ${invoiceLabel(invoice)} from ${company.name} — ${money(invoice.grand_total)}`;
  const html = layout(
    company,
    `
    <p>Dear ${esc(customer.contact_person || customer.name)},</p>
    ${message ? `<p>${esc(message).replaceAll("\n", "<br/>")}</p>` : `<p>Please find attached invoice <b>${esc(invoiceLabel(invoice))}</b>.</p>`}
    <table style="border-collapse:collapse;margin:10px 0;">
      <tr><td style="padding:4px 16px 4px 0;color:#555;">Invoice</td><td><b>${esc(invoiceLabel(invoice))}</b></td></tr>
      <tr><td style="padding:4px 16px 4px 0;color:#555;">Date</td><td>${esc(fmtDate(invoice.invoice_date))}</td></tr>
      ${invoice.due_date ? `<tr><td style="padding:4px 16px 4px 0;color:#555;">Due date</td><td>${esc(fmtDate(invoice.due_date))}</td></tr>` : ""}
      <tr><td style="padding:4px 16px 4px 0;color:#555;">Amount</td><td><b>${money(invoice.grand_total)}</b></td></tr>
      ${Number(invoice.paid_total) > 0 ? `<tr><td style="padding:4px 16px 4px 0;color:#555;">Balance due</td><td><b>${money(invoice.due_total)}</b></td></tr>` : ""}
    </table>
    ${Number(invoice.due_total) > 0 ? portalButton(portalUrl) : portalButton(portalUrl, "View your invoices")}
    ${paymentBlock(company, invoice.due_total)}
    <p>Thank you for your business.</p>`
  );
  return { subject, html };
}

function reminderEmail({ company, customer, invoice, daysOverdue, portalUrl }) {
  const subject = `Payment reminder: Invoice ${invoiceLabel(invoice)} — ${money(invoice.due_total)} due`;
  const html = layout(
    company,
    `
    <p>Dear ${esc(customer.contact_person || customer.name)},</p>
    <p>This is a friendly reminder that <b>${money(invoice.due_total)}</b> is pending on invoice
      <b>${esc(invoiceLabel(invoice))}</b>${
        daysOverdue > 0
          ? `, which was due on ${esc(fmtDate(invoice.due_date || invoice.invoice_date))} (${daysOverdue} days ago)`
          : ""
      }.</p>
    ${portalButton(portalUrl, "Pay online now")}
    ${paymentBlock(company, invoice.due_total)}
    <p>If you have already paid, please ignore this email or reply with the payment reference.</p>`
  );
  return { subject, html };
}

function renewalAlertEmail({ company, renewal, invoice, portalUrl }) {
  const dueTxt = fmtDate(renewal.next_due_date);
  const expired = Number(renewal.days_left) < 0;
  const subject = expired
    ? `Expired: ${renewal.name}${renewal.service_ref ? ` (${renewal.service_ref})` : ""} — renewal overdue`
    : `Renewal due on ${dueTxt}: ${renewal.name}${renewal.service_ref ? ` (${renewal.service_ref})` : ""}`;

  const amount = invoice ? invoice.due_total : renewal.amount;
  const html = layout(
    company,
    `
    <p>Dear ${esc(renewal.customer_name || "Customer")},</p>
    <p>Your <b>${esc(renewal.service_type)}</b> service <b>${esc(renewal.name)}</b>${
      renewal.service_ref ? ` (<b>${esc(renewal.service_ref)}</b>)` : ""
    } ${expired ? `expired on <b>${esc(dueTxt)}</b>` : `is due for renewal on <b>${esc(dueTxt)}</b>`}.</p>
    <p>Please renew it to avoid any interruption in service.</p>
    <table style="border-collapse:collapse;margin:10px 0;">
      <tr><td style="padding:4px 16px 4px 0;color:#555;">Billing cycle</td><td>${esc(renewal.cycle)}</td></tr>
      <tr><td style="padding:4px 16px 4px 0;color:#555;">Amount</td><td><b>${money(amount)}</b>${invoice ? "" : " + GST"}</td></tr>
      ${invoice ? `<tr><td style="padding:4px 16px 4px 0;color:#555;">Invoice</td><td><b>${esc(invoiceLabel(invoice))}</b> (attached)</td></tr>` : ""}
    </table>
    ${invoice ? portalButton(portalUrl, "Pay online now") : ""}
    ${paymentBlock(company, amount)}`
  );
  return { subject, html };
}

/** WhatsApp text (plain, *bold* is WhatsApp markdown) */
function invoiceWhatsappText({ company, customer, invoice, portalUrl }) {
  const lines = [
    `Dear ${customer.contact_person || customer.name},`,
    ``,
    `Invoice *${invoiceLabel(invoice)}* from *${company.name}*`,
    `Date: ${fmtDate(invoice.invoice_date)}`,
    `Amount: *${money(invoice.grand_total)}*`,
  ];
  if (Number(invoice.paid_total) > 0) lines.push(`Balance due: *${money(invoice.due_total)}*`);
  if (invoice.due_date) lines.push(`Due date: ${fmtDate(invoice.due_date)}`);
  if (Number(invoice.due_total) > 0 && company.upi_id) {
    lines.push(``, `Pay via UPI: *${company.upi_id}*`);
  }
  if (portalUrl) {
    lines.push(``, Number(invoice.due_total) > 0 ? `View invoice & pay online: ${portalUrl}` : `View invoice: ${portalUrl}`);
  }
  lines.push(``, `Thank you!`);
  return lines.join("\n");
}

module.exports = { invoiceEmail, reminderEmail, renewalAlertEmail, invoiceWhatsappText, invoiceLabel };
