const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");
const pool = require("../../config/db");
const crypto = require("crypto");

function makeVerifyCode({ companyId, invoiceId, paymentId, createdAt }) {
  const secret = process.env.PDF_VERIFY_SECRET || process.env.JWT_SECRET || "change_me";
  const raw = `${companyId}|${invoiceId || ""}|${paymentId || ""}|${createdAt || ""}`;
  return crypto.createHmac("sha256", secret).update(raw).digest("hex").slice(0, 12).toUpperCase();
}

function formatDateShort(d) {
  if (!d) return "";
  const dt = new Date(d);
  return dt.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function escapeHtml(s) {
  if (s === null || s === undefined) return "";
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function fillTemplate(html, map) {
  let out = html;
  for (const [k, v] of Object.entries(map)) {
    out = out.replaceAll(`{{${k}}}`, v);
  }
  return out;
}

// ✅ Convert /uploads/... file to data-uri so puppeteer never fails to load images
function toDataUriFromUploads(urlPath) {
  try {
    if (!urlPath) return "";
    // urlPath example: /uploads/logos/logo-1.png
    const abs = path.join(process.cwd(), urlPath.replaceAll("/", path.sep));
    if (!fs.existsSync(abs)) return "";

    const ext = path.extname(abs).toLowerCase();
    const mime =
      ext === ".png"
        ? "image/png"
        : ext === ".jpg" || ext === ".jpeg"
          ? "image/jpeg"
          : ext === ".webp"
            ? "image/webp"
            : "image/png";

    const b64 = fs.readFileSync(abs).toString("base64");
    return `data:${mime};base64,${b64}`;
  } catch {
    return "";
  }
}

async function getCompanyCustomerInvoice(companyId, invoiceId) {
  const [invRows] = await pool.query(
    "SELECT * FROM invoices WHERE id=? AND company_id=? LIMIT 1",
    [invoiceId, companyId]
  );
  const invoice = invRows[0];
  if (!invoice) return null;

  const [items] = await pool.query(
    "SELECT * FROM invoice_items WHERE invoice_id=? ORDER BY id ASC",
    [invoiceId]
  );

  const [custRows] = await pool.query(
    "SELECT * FROM customers WHERE id=? AND company_id=? LIMIT 1",
    [invoice.customer_id, companyId]
  );

  const [compRows] = await pool.query(
    "SELECT * FROM companies WHERE id=? LIMIT 1",
    [companyId]
  );

  return {
    invoice,
    items,
    customer: custRows[0] || {},
    company: compRows[0] || {},
  };
}

async function getReceiptData(companyId, invoiceId, paymentId) {
  const data = await getCompanyCustomerInvoice(companyId, invoiceId);
  if (!data) return null;

  // ✅ paymentId must be valid number
  if (!paymentId || Number.isNaN(paymentId)) return null;

  // ✅ safest: payments -> invoices (company check invoice se)
  const [payRows] = await pool.query(
    `SELECT p.*
     FROM payments p
     JOIN invoices i ON i.id = p.invoice_id
     WHERE i.company_id = ?
       AND p.invoice_id = ?
       AND p.id = ?
     LIMIT 1`,
    [companyId, invoiceId, paymentId]
  );

  const payment = payRows[0];
  if (!payment) return null;

  return { ...data, payment };
}


async function htmlToPdfBuffer(html) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const buf = await page.pdf({
      format: "A4",
      printBackground: true,
      // keep margins small to avoid 2 pages
      margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
    });

    return buf;
  } finally {
    await browser.close();
  }
}

async function generateInvoicePdf(companyId, invoiceId) {
  const data = await getCompanyCustomerInvoice(companyId, invoiceId);
  if (!data) return null;

  const templatePath = path.join(__dirname, "templates", "invoice.html");
  const html = fs.readFileSync(templatePath, "utf-8");

  // ✅ items rows
  const itemsRows = (data.items || [])
    .map((it, idx) => {
      return `
        <tr>
          <td class="c">${idx + 1}</td>
          <td>
            <div class="desc">${escapeHtml(it.description)}</div>
            <div class="sub">${escapeHtml(it.type || "")}</div>
          </td>
          <td>${escapeHtml(it.hsn_sac || "")}</td>
          <td class="r">${escapeHtml(it.qty)}</td>
          <td class="r">${escapeHtml(it.rate)}</td>
          <td class="r">${escapeHtml(it.discount_percent)}</td>
          <td class="r">${escapeHtml(it.tax_percent)}</td>
          <td class="r"><b>${escapeHtml(it.line_total)}</b></td>
        </tr>
      `;
    })
    .join("");

  // ✅ data-uri images
  const logoDataUri = toDataUriFromUploads(data.company.logo_url);
  const signDataUri = toDataUriFromUploads(data.company.signature_url);

  // ✅ placeholders (HTML snippets) — DO NOT escape these
  const companyLogo = logoDataUri
    ? `<img src="${logoDataUri}" alt="logo" />`
    : "";

  const companySignature = signDataUri
    ? `<img src="${signDataUri}" alt="signature" />`
    : "";

  const status = String(data.invoice.status || "").toUpperCase();
  const invoiceStatusBadge =
    status === "FINAL"
      ? `<span class="badge paid">FINAL</span>`
      : `<span class="badge due">${escapeHtml(status || "DRAFT")}</span>`;

  const due = Number(data.invoice.due_total || 0);
  const dueBadge =
    due <= 0
      ? `<span class="badge paid">₹ ${escapeHtml(data.invoice.due_total)} PAID</span>`
      : `<span class="badge due">₹ ${escapeHtml(data.invoice.due_total)} DUE</span>`;

  const filled = fillTemplate(html, {
    // ✅ new placeholders
    companyLogo,
    companySignature,
    invoiceStatusBadge,
    dueBadge,

    // company
    "company.name": escapeHtml(data.company.name),
    "company.legal_name": escapeHtml(data.company.legal_name),
    "company.gstin": escapeHtml(data.company.gstin),
    "company.pan": escapeHtml(data.company.pan),
    "company.billing_address_line1": escapeHtml(data.company.billing_address_line1),
    "company.billing_address_line2": escapeHtml(data.company.billing_address_line2),
    "company.billing_city": escapeHtml(data.company.billing_city),
    "company.billing_state": escapeHtml(data.company.billing_state),
    "company.billing_pincode": escapeHtml(data.company.billing_pincode),
    "company.bank_name": escapeHtml(data.company.bank_name),
    "company.bank_account_no": escapeHtml(data.company.bank_account_no),
    "company.bank_ifsc": escapeHtml(data.company.bank_ifsc),
    "company.upi_id": escapeHtml(data.company.upi_id),

    // customer
    "customer.name": escapeHtml(data.customer.name),
    "customer.gstin": escapeHtml(data.customer.gstin),
    "customer.billing_address_line1": escapeHtml(data.customer.billing_address_line1),
    "customer.billing_address_line2": escapeHtml(data.customer.billing_address_line2),
    "customer.billing_city": escapeHtml(data.customer.billing_city),
    "customer.billing_state": escapeHtml(data.customer.billing_state),
    "customer.billing_pincode": escapeHtml(data.customer.billing_pincode),

    // invoice
    "invoice.invoice_no": escapeHtml(data.invoice.invoice_no),
    "invoice.invoice_date": escapeHtml(formatDateShort(data.invoice.invoice_date)),
    "invoice.status": escapeHtml(data.invoice.status),
    "invoice.place_of_supply_state": escapeHtml(data.invoice.place_of_supply_state),
    "invoice.notes": escapeHtml(data.invoice.notes),
    "invoice.terms": escapeHtml(data.invoice.terms),

    "invoice.subtotal": escapeHtml(data.invoice.subtotal),
    "invoice.discount_total": escapeHtml(data.invoice.discount_total),
    "invoice.taxable_total": escapeHtml(data.invoice.taxable_total),
    "invoice.cgst_total": escapeHtml(data.invoice.cgst_total),
    "invoice.sgst_total": escapeHtml(data.invoice.sgst_total),
    "invoice.igst_total": escapeHtml(data.invoice.igst_total),
    "invoice.grand_total": escapeHtml(data.invoice.grand_total),
    "invoice.paid_total": escapeHtml(data.invoice.paid_total),
    "invoice.due_total": escapeHtml(data.invoice.due_total),

    itemsRows,
  });

  const pdf = await htmlToPdfBuffer(filled);
  return { pdf, invoiceNo: data.invoice.invoice_no };
}

async function generateReceiptPdf(companyId, invoiceId, paymentId) {
  const data = await getReceiptData(companyId, invoiceId, paymentId);
  if (!data) return null;

  const templatePath = path.join(__dirname, "templates", "receipt.html");
  const html = fs.readFileSync(templatePath, "utf-8");

  // ✅ images (same like invoice)
  const logoDataUri = toDataUriFromUploads(data.company.logo_url);
  const signDataUri = toDataUriFromUploads(data.company.signature_url);

  const companyLogo = logoDataUri ? `<img src="${logoDataUri}" alt="logo" />` : "";
  const companySignature = signDataUri ? `<img src="${signDataUri}" alt="signature" />` : `<div class="signEmpty">Signature not set</div>`;

  // ✅ receipt status badge
  const receiptStatusBadge = `<span class="badge paid">RECEIVED</span>`;

  // ✅ due badge based on invoice due
  const due = Number(data.invoice.due_total || 0);
  const dueBadge =
    due <= 0
      ? `<span class="badge paid">PAID</span>`
      : `<span class="badge due">DUE: ₹ ${escapeHtml(data.invoice.due_total)}</span>`;

  const filled = fillTemplate(html, {
    // ✅ NEW placeholders for receipt.html
    companyLogo,
    companySignature,
    receiptStatusBadge,
    dueBadge,

    "company.name": escapeHtml(data.company.name),
    "company.billing_city": escapeHtml(data.company.billing_city),
    "company.billing_state": escapeHtml(data.company.billing_state),
    "company.gstin": escapeHtml(data.company.gstin),

    "invoice.invoice_no": escapeHtml(data.invoice.invoice_no),
    "invoice.grand_total": escapeHtml(data.invoice.grand_total),
    "invoice.paid_total": escapeHtml(data.invoice.paid_total),
    "invoice.due_total": escapeHtml(data.invoice.due_total),

    "customer.name": escapeHtml(data.customer.name),

    "payment.id": escapeHtml(data.payment.id),
    "payment.payment_date": escapeHtml(formatDateShort(data.payment.payment_date)),
    "payment.amount": escapeHtml(data.payment.amount),
    "payment.mode": escapeHtml(data.payment.mode),
    "payment.reference_no": escapeHtml(data.payment.reference_no),
    "payment.notes": escapeHtml(data.payment.notes),
  });

  const pdf = await htmlToPdfBuffer(filled);

const verifyCode = makeVerifyCode({
  companyId,
  invoiceId,
  paymentId,
  createdAt: data.payment.created_at || data.payment.payment_date,
});

const watermarkText = "RECEIPT";

  return { pdf, receiptId: data.payment.id, invoiceNo: data.invoice.invoice_no };
}



module.exports = { generateInvoicePdf, generateReceiptPdf ,getReceiptData};
