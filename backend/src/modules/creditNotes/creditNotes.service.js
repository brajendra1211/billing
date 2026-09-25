const fs = require("fs");
const path = require("path");
const pool = require("../../config/db");
const invoicesRepo = require("../invoices/invoices.repository");
const pdf = require("../pdf/pdf.service");
const { getFinancialYear, formatInvoiceNo } = require("../../utils/invoice");
const { writeAudit } = require("../../utils/audit");

const CN_PREFIX = "UCN";

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function httpError(status, message) {
  const err = new Error(message);
  err.statusCode = status;
  return err;
}

/** Invoice lines with how much has already been credited against each */
async function creditableLines(connOrPool, invoiceId) {
  const [rows] = await connOrPool.query(
    `SELECT ii.*,
            COALESCE(SUM(cni.qty),0) AS credited_qty,
            COALESCE(SUM(cni.taxable_amount),0) AS credited_taxable,
            COALESCE(SUM(cni.cgst_amount),0) AS credited_cgst,
            COALESCE(SUM(cni.sgst_amount),0) AS credited_sgst,
            COALESCE(SUM(cni.igst_amount),0) AS credited_igst
     FROM invoice_items ii
     LEFT JOIN credit_note_items cni ON cni.invoice_item_id=ii.id
     WHERE ii.invoice_id=?
     GROUP BY ii.id
     ORDER BY ii.id ASC`,
    [invoiceId]
  );
  return rows.map((r) => ({
    ...r,
    remaining_qty: round2(Number(r.qty) - Number(r.credited_qty)),
  }));
}

async function listForInvoice(companyId, invoiceId) {
  const [[inv]] = await pool.query("SELECT id FROM invoices WHERE id=? AND company_id=?", [invoiceId, companyId]);
  if (!inv) throw httpError(404, "Invoice not found");

  const [notes] = await pool.query(
    "SELECT * FROM credit_notes WHERE company_id=? AND invoice_id=? ORDER BY id ASC",
    [companyId, invoiceId]
  );
  const lines = await creditableLines(pool, invoiceId);
  return { notes, lines };
}

async function listAll(companyId, { from, to } = {}) {
  const where = ["cn.company_id=?"];
  const params = [companyId];
  if (from) {
    where.push("cn.cn_date>=?");
    params.push(from);
  }
  if (to) {
    where.push("cn.cn_date<=?");
    params.push(to);
  }
  const [rows] = await pool.query(
    `SELECT cn.*, i.invoice_no, c.name AS customer_name
     FROM credit_notes cn
     JOIN invoices i ON i.id=cn.invoice_id
     JOIN customers c ON c.id=cn.customer_id
     WHERE ${where.join(" AND ")}
     ORDER BY cn.cn_date DESC, cn.id DESC
     LIMIT 500`,
    params
  );
  return rows;
}

async function createCreditNote({ companyId, userId, invoiceId, body }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[inv]] = await conn.query(
      "SELECT * FROM invoices WHERE id=? AND company_id=? FOR UPDATE",
      [invoiceId, companyId]
    );
    if (!inv) throw httpError(404, "Invoice not found");
    if (inv.status !== "FINAL") {
      throw httpError(400, "Credit note sirf FINAL invoice pe ban sakta hai. DRAFT invoice ko edit karein.");
    }
    if (body.cn_date < String(inv.invoice_date).slice(0, 10)) {
      throw httpError(400, "Credit note ki date invoice date se pehle nahi ho sakti");
    }

    const lines = await creditableLines(conn, invoiceId);
    const byId = new Map(lines.map((l) => [Number(l.id), l]));

    const cnLines = [];
    for (const req of body.lines) {
      const qty = round2(req.qty);
      if (!(qty > 0)) continue;
      const it = byId.get(Number(req.invoice_item_id));
      if (!it) throw httpError(400, `Invoice line not found: ${req.invoice_item_id}`);
      if (qty > it.remaining_qty + 0.001) {
        throw httpError(400, `"${it.description}" pe sirf ${it.remaining_qty} qty credit ho sakti hai`);
      }

      let taxable, cgst, sgst, igst;
      if (Math.abs(qty - it.remaining_qty) < 0.005) {
        // Last credit on this line: take exactly what's left so rounding never drifts
        taxable = round2(it.taxable_amount - it.credited_taxable);
        cgst = round2(it.cgst_amount - it.credited_cgst);
        sgst = round2(it.sgst_amount - it.credited_sgst);
        igst = round2(it.igst_amount - it.credited_igst);
      } else {
        const ratio = qty / Number(it.qty);
        taxable = round2(it.taxable_amount * ratio);
        cgst = round2(it.cgst_amount * ratio);
        sgst = round2(it.sgst_amount * ratio);
        igst = round2(it.igst_amount * ratio);
      }

      cnLines.push({
        invoice_item_id: it.id,
        item_id: it.item_id,
        description: it.description,
        hsn_sac: it.hsn_sac,
        qty,
        rate: it.rate,
        tax_percent: it.tax_percent,
        taxable_amount: taxable,
        cgst_amount: cgst,
        sgst_amount: sgst,
        igst_amount: igst,
        line_total: round2(taxable + cgst + sgst + igst),
      });
    }
    if (!cnLines.length) throw httpError(400, "Kam se kam ek line ki qty dalein");

    const sum = (k) => round2(cnLines.reduce((s, l) => s + Number(l[k]), 0));
    const totals = {
      taxable_total: sum("taxable_amount"),
      cgst_total: sum("cgst_amount"),
      sgst_total: sum("sgst_amount"),
      igst_total: sum("igst_amount"),
      grand_total: sum("line_total"),
    };
    if (!(totals.grand_total > 0)) throw httpError(400, "Credit amount must be > 0");

    const fy = getFinancialYear(body.cn_date);
    const cnNumber = await invoicesRepo.nextInvoiceNumber(conn, companyId, fy, CN_PREFIX);
    const cnNo = formatInvoiceNo(CN_PREFIX, fy, cnNumber);

    const [ins] = await conn.query(
      `INSERT INTO credit_notes
       (company_id, invoice_id, customer_id, financial_year, prefix, cn_number, cn_no, cn_date, reason, is_interstate,
        taxable_total, cgst_total, sgst_total, igst_total, grand_total, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        companyId, invoiceId, inv.customer_id, fy, CN_PREFIX, cnNumber, cnNo, body.cn_date, body.reason,
        inv.is_interstate ? 1 : 0,
        totals.taxable_total, totals.cgst_total, totals.sgst_total, totals.igst_total, totals.grand_total,
        userId || null,
      ]
    );
    const cnId = ins.insertId;

    for (const l of cnLines) {
      await conn.query(
        `INSERT INTO credit_note_items
         (credit_note_id, invoice_item_id, item_id, description, hsn_sac, qty, rate, tax_percent,
          taxable_amount, cgst_amount, sgst_amount, igst_amount, line_total)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          cnId, l.invoice_item_id, l.item_id, l.description, l.hsn_sac, l.qty, l.rate, l.tax_percent,
          l.taxable_amount, l.cgst_amount, l.sgst_amount, l.igst_amount, l.line_total,
        ]
      );
    }

    let balances = await invoicesRepo.recomputeBalances(conn, companyId, invoiceId, userId);

    // Optional refund of money the customer has overpaid after this credit
    const refund = round2(body.refund_amount || 0);
    if (refund > 0) {
      if (refund > balances.customer_credit + 0.001) {
        throw httpError(400, `Refund sirf ₹${balances.customer_credit} tak ho sakta hai (customer ka extra paid amount)`);
      }
      await conn.query(
        "UPDATE credit_notes SET refund_amount=?, refund_mode=?, refund_reference=? WHERE id=?",
        [refund, body.refund_mode || "OTHER", body.refund_reference || null, cnId]
      );
      balances = await invoicesRepo.recomputeBalances(conn, companyId, invoiceId, userId);
    }

    await writeAudit(conn, {
      companyId,
      userId,
      entityType: "INVOICE",
      entityId: invoiceId,
      action: "CREDIT_NOTE",
      oldValues: { credit_total: inv.credit_total, due_total: inv.due_total },
      newValues: { credit_note_id: cnId, cn_no: cnNo, amount: totals.grand_total, refund, ...balances },
      note: body.reason,
    });

    await conn.commit();
    return { id: cnId, cn_no: cnNo, ...totals, refund_amount: refund, balances };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function generateCreditNotePdf(companyId, cnId) {
  const [[cn]] = await pool.query("SELECT * FROM credit_notes WHERE id=? AND company_id=?", [cnId, companyId]);
  if (!cn) return null;
  const data = await pdf.getCompanyCustomerInvoice(companyId, cn.invoice_id);
  if (!data) return null;
  const [items] = await pool.query("SELECT * FROM credit_note_items WHERE credit_note_id=? ORDER BY id", [cnId]);

  const e = pdf.escapeHtml;
  const itemsRows = items
    .map((it, idx) => {
      const gst = round2(Number(it.cgst_amount) + Number(it.sgst_amount) + Number(it.igst_amount)).toFixed(2);
      return `
        <tr>
          <td class="c">${idx + 1}</td>
          <td><div class="desc">${e(it.description)}</div></td>
          <td>${e(it.hsn_sac || "")}</td>
          <td class="r">${e(it.qty)}</td>
          <td class="r">${e(it.taxable_amount)}</td>
          <td class="r">${e(it.tax_percent)}</td>
          <td class="r">${e(gst)}</td>
          <td class="r"><b>${e(it.line_total)}</b></td>
        </tr>`;
    })
    .join("");

  const logo = pdf.toDataUriFromUploads(data.company.logo_url);
  const sign = pdf.toDataUriFromUploads(data.company.signature_url);
  let refundBlock = "";
  if (Number(cn.refund_amount) > 0) {
    const ref = cn.refund_reference ? ` (Ref: ${e(cn.refund_reference)})` : "";
    refundBlock = `<div class="sectionTitle">Refund</div>
      <div>₹ <b>${e(cn.refund_amount)}</b> refunded via ${e(cn.refund_mode || "")}${ref}</div>`;
  }

  const html = fs.readFileSync(path.join(__dirname, "..", "pdf", "templates", "credit_note.html"), "utf-8");
  const filled = pdf.fillTemplate(html, {
    companyLogo: logo ? `<img src="${logo}" alt="logo" />` : "",
    companySignature: sign ? `<img src="${sign}" alt="signature" />` : "",
    refundBlock,
    itemsRows,

    "company.name": e(data.company.name),
    "company.legal_name": e(data.company.legal_name),
    "company.gstin": e(data.company.gstin),
    "company.pan": e(data.company.pan),
    "company.billing_address_line1": e(data.company.billing_address_line1),
    "company.billing_address_line2": e(data.company.billing_address_line2),
    "company.billing_city": e(data.company.billing_city),
    "company.billing_state": e(data.company.billing_state),
    "company.billing_pincode": e(data.company.billing_pincode),

    "customer.name": e(data.customer.name),
    "customer.gstin": e(data.customer.gstin),
    "customer.billing_address_line1": e(data.customer.billing_address_line1),
    "customer.billing_address_line2": e(data.customer.billing_address_line2),
    "customer.billing_city": e(data.customer.billing_city),
    "customer.billing_state": e(data.customer.billing_state),
    "customer.billing_pincode": e(data.customer.billing_pincode),

    "invoice.invoice_no": e(data.invoice.invoice_no),
    "invoice.invoice_date": e(pdf.formatDateShort(data.invoice.invoice_date)),

    "cn.cn_no": e(cn.cn_no),
    "cn.cn_date": e(pdf.formatDateShort(cn.cn_date)),
    "cn.reason": e(cn.reason),
    "cn.taxable_total": e(cn.taxable_total),
    "cn.cgst_total": e(cn.cgst_total),
    "cn.sgst_total": e(cn.sgst_total),
    "cn.igst_total": e(cn.igst_total),
    "cn.grand_total": e(cn.grand_total),
  });

  return { pdf: await pdf.htmlToPdfBuffer(filled), cnNo: cn.cn_no };
}

module.exports = { listForInvoice, listAll, createCreditNote, generateCreditNotePdf };
