const fs = require("fs");
const path = require("path");
const pool = require("../../config/db");
const invoicesService = require("../invoices/invoices.service");
const invoicesRepo = require("../invoices/invoices.repository");
const pdf = require("../pdf/pdf.service");
const notifRepo = require("../notifications/notifications.repository");
const portalTokens = require("../portal/portal.tokens");
const { assertOwned } = require("../../utils/ownership");
const { writeAudit } = require("../../utils/audit");
const { sendMail } = require("../../utils/mailer");
const { upiQrDataUri } = require("../../utils/upi");
const { getFinancialYear, formatInvoiceNo } = require("../../utils/invoice");

const DEMAND_PREFIX = "UDL";

function r2(n) {
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

function money(n) {
  return `₹ ${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/* ---------------- amounts ---------------- */

/**
 * PERCENT: percentages must add up to 100; the last milestone absorbs rounding.
 * AMOUNT: amounts must add up to the total.
 */
function splitMilestones(total, milestones, mode) {
  total = r2(total);
  if (mode === "PERCENT") {
    const sumPct = r2(milestones.reduce((s, m) => s + Number(m.percent || 0), 0));
    if (Math.abs(sumPct - 100) > 0.01) throw httpError(400, `Milestones ka total 100% hona chahiye (abhi ${sumPct}%)`);
    let used = 0;
    return milestones.map((m, i) => {
      const amount = i === milestones.length - 1 ? r2(total - used) : r2((total * Number(m.percent || 0)) / 100);
      used = r2(used + amount);
      return { ...m, percent: r2(m.percent), amount };
    });
  }
  const sum = r2(milestones.reduce((s, m) => s + Number(m.amount || 0), 0));
  if (Math.abs(sum - total) > 0.01) throw httpError(400, `Milestones ka total ${money(total)} hona chahiye (abhi ${money(sum)})`);
  return milestones.map((m) => ({ ...m, amount: r2(m.amount), percent: r2((Number(m.amount) / total) * 100) }));
}

function milestoneStatus(m, today = todayISO()) {
  if (m.invoice_id && m.inv_status && m.inv_status !== "CANCELLED") {
    if (Number(m.inv_due_total) <= 0) return "PAID";
    if (Number(m.inv_paid_total) > 0) return "PART_PAID";
    return "INVOICED";
  }
  if (m.due_date && String(m.due_date).slice(0, 10) < today) return "OVERDUE";
  if (Number(m.demand_count) > 0) return "DEMANDED";
  return "PENDING";
}

/* ---------------- read ---------------- */

async function loadMilestones(db, planId) {
  const [rows] = await db.query(
    `SELECT m.*, i.invoice_no, i.status AS inv_status, i.grand_total AS inv_grand_total,
            i.paid_total AS inv_paid_total, i.due_total AS inv_due_total
     FROM payment_plan_milestones m
     LEFT JOIN invoices i ON i.id=m.invoice_id
     WHERE m.plan_id=?
     ORDER BY m.seq ASC, m.id ASC`,
    [planId]
  );
  return rows.map((m) => ({ ...m, status: milestoneStatus(m) }));
}

function summarize(plan, milestones) {
  const tax = r2((Number(plan.total_amount) * Number(plan.tax_percent)) / 100);
  const active = milestones.filter((m) => m.invoice_id && m.inv_status && m.inv_status !== "CANCELLED");
  const next = milestones.find((m) => m.status !== "PAID");
  return {
    total_taxable: r2(plan.total_amount),
    total_tax: tax,
    total_payable: r2(Number(plan.total_amount) + tax),
    invoiced: r2(active.reduce((s, m) => s + Number(m.inv_grand_total || 0), 0)),
    received: r2(active.reduce((s, m) => s + Number(m.inv_paid_total || 0), 0)),
    milestones_paid: milestones.filter((m) => m.status === "PAID").length,
    milestones_total: milestones.length,
    next_milestone: next ? { id: next.id, seq: next.seq, title: next.title, due_date: next.due_date, status: next.status } : null,
    completed: milestones.length > 0 && milestones.every((m) => m.status === "PAID"),
  };
}

async function getPlanRow(db, companyId, planId, lock = false) {
  const [[plan]] = await db.query(
    `SELECT p.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone,
            it.name AS item_name, it.hsn_sac AS item_hsn
     FROM payment_plans p
     JOIN customers c ON c.id=p.customer_id
     LEFT JOIN items it ON it.id=p.item_id
     WHERE p.id=? AND p.company_id=? ${lock ? "FOR UPDATE" : ""}`,
    [planId, companyId]
  );
  if (!plan) throw httpError(404, "Payment plan not found");
  return plan;
}

async function getPlan(companyId, planId) {
  const plan = await getPlanRow(pool, companyId, planId);
  const milestones = await loadMilestones(pool, planId);
  return { plan, milestones, summary: summarize(plan, milestones) };
}

async function listPlans(companyId, { customer_id } = {}) {
  const params = [companyId];
  let extra = "";
  if (customer_id) {
    extra = " AND p.customer_id=?";
    params.push(Number(customer_id));
  }
  const [plans] = await pool.query(
    `SELECT p.*, c.name AS customer_name
     FROM payment_plans p JOIN customers c ON c.id=p.customer_id
     WHERE p.company_id=?${extra}
     ORDER BY p.id DESC LIMIT 500`,
    params
  );
  const out = [];
  for (const p of plans) {
    const ms = await loadMilestones(pool, p.id);
    out.push({ ...p, summary: summarize(p, ms) });
  }
  return out;
}

/* ---------------- create / update ---------------- */

async function validateRefs(db, companyId, body) {
  await assertOwned(db, "customers", companyId, body.customer_id, "Customer");
  if (body.item_id) await assertOwned(db, "items", companyId, body.item_id, "Item");
}

async function createPlan(companyId, userId, body) {
  const ms = splitMilestones(body.total_amount, body.milestones, body.split_mode);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await validateRefs(conn, companyId, body);
    const [ins] = await conn.query(
      `INSERT INTO payment_plans (company_id, customer_id, title, description, item_id, total_amount, tax_percent, created_by)
       VALUES (?,?,?,?,?,?,?,?)`,
      [companyId, body.customer_id, body.title, body.description || null, body.item_id || null, r2(body.total_amount), body.tax_percent, userId]
    );
    const planId = ins.insertId;
    let seq = 1;
    for (const m of ms) {
      await conn.query(
        `INSERT INTO payment_plan_milestones (plan_id, company_id, seq, title, percent, amount, due_date)
         VALUES (?,?,?,?,?,?,?)`,
        [planId, companyId, seq++, m.title, m.percent, m.amount, m.due_date || null]
      );
    }
    await writeAudit(conn, {
      companyId, userId, entityType: "PAYMENT_PLAN", entityId: planId, action: "CREATE",
      newValues: { title: body.title, total: body.total_amount, milestones: ms.map((m) => m.amount) },
    });
    await conn.commit();
    return { id: planId };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/**
 * Before any milestone is invoiced everything can change. After that, the
 * invoiced milestones are frozen: only titles / due dates of the others and
 * the plan's title/description can be edited.
 */
async function updatePlan(companyId, userId, planId, body) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const plan = await getPlanRow(conn, companyId, planId, true);
    if (plan.status === "CANCELLED") throw httpError(400, "Cancelled plan edit nahi ho sakta");
    const existing = await loadMilestones(conn, planId);
    const invoiced = existing.filter((m) => m.invoice_id && m.inv_status !== "CANCELLED");

    if (invoiced.length) {
      const sameShape =
        Number(body.customer_id) === Number(plan.customer_id) &&
        Math.abs(Number(body.total_amount) - Number(plan.total_amount)) < 0.01 &&
        Number(body.tax_percent) === Number(plan.tax_percent) &&
        body.milestones.length === existing.length &&
        body.milestones.every((m, i) => Number(m.id) === Number(existing[i].id));
      if (!sameShape) {
        throw httpError(400, "Is plan ka invoice ban chuka hai. Ab sirf project ka naam, milestone ke naam aur due dates badal sakte hain.");
      }
      const ms = splitMilestones(body.total_amount, body.milestones, body.split_mode);
      for (let i = 0; i < ms.length; i++) {
        const old = existing[i];
        const locked = old.invoice_id && old.inv_status !== "CANCELLED";
        if (locked && Math.abs(ms[i].amount - Number(old.amount)) > 0.01) {
          throw httpError(400, `Milestone "${old.title}" ka invoice ban chuka hai, uska amount nahi badal sakta`);
        }
        await conn.query(
          "UPDATE payment_plan_milestones SET title=?, due_date=?, percent=?, amount=? WHERE id=? AND plan_id=?",
          [ms[i].title, ms[i].due_date || null, locked ? old.percent : ms[i].percent, locked ? old.amount : ms[i].amount, old.id, planId]
        );
      }
      await conn.query(
        "UPDATE payment_plans SET title=?, description=?, item_id=? WHERE id=?",
        [body.title, body.description || null, body.item_id || null, planId]
      );
    } else {
      await validateRefs(conn, companyId, body);
      const ms = splitMilestones(body.total_amount, body.milestones, body.split_mode);
      await conn.query(
        "UPDATE payment_plans SET customer_id=?, title=?, description=?, item_id=?, total_amount=?, tax_percent=? WHERE id=?",
        [body.customer_id, body.title, body.description || null, body.item_id || null, r2(body.total_amount), body.tax_percent, planId]
      );
      // update rows the client kept (keeps demand numbers), add new ones, drop removed ones
      const keepIds = new Set();
      let seq = 1;
      for (const m of ms) {
        const own = m.id && existing.find((x) => Number(x.id) === Number(m.id));
        if (own) {
          keepIds.add(Number(m.id));
          await conn.query(
            "UPDATE payment_plan_milestones SET seq=?, title=?, percent=?, amount=?, due_date=? WHERE id=?",
            [seq++, m.title, m.percent, m.amount, m.due_date || null, m.id]
          );
        } else {
          const [ins] = await conn.query(
            `INSERT INTO payment_plan_milestones (plan_id, company_id, seq, title, percent, amount, due_date)
             VALUES (?,?,?,?,?,?,?)`,
            [planId, companyId, seq++, m.title, m.percent, m.amount, m.due_date || null]
          );
          keepIds.add(ins.insertId);
        }
      }
      for (const old of existing) {
        if (!keepIds.has(Number(old.id))) await conn.query("DELETE FROM payment_plan_milestones WHERE id=?", [old.id]);
      }
    }

    await writeAudit(conn, { companyId, userId, entityType: "PAYMENT_PLAN", entityId: planId, action: "UPDATE", newValues: { title: body.title } });
    await conn.commit();
    return { id: planId };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function cancelPlan(companyId, userId, planId) {
  await getPlanRow(pool, companyId, planId);
  await pool.query("UPDATE payment_plans SET status='CANCELLED' WHERE id=? AND company_id=?", [planId, companyId]);
  await writeAudit(pool, { companyId, userId, entityType: "PAYMENT_PLAN", entityId: planId, action: "CANCEL" });
  return { cancelled: true };
}

/* ---------------- milestone -> tax invoice ---------------- */

async function findOrCreateMilestoneItem(companyId) {
  const [[row]] = await pool.query(
    "SELECT id FROM items WHERE company_id=? AND name='Project Milestone' LIMIT 1",
    [companyId]
  );
  if (row) return row.id;
  const [ins] = await pool.query(
    `INSERT INTO items (company_id, type, name, sale_price, tax_percent, hsn_sac, unit)
     VALUES (?, 'SERVICE', 'Project Milestone', 0, 18, NULL, 'Nos')`,
    [companyId]
  );
  return ins.insertId;
}

async function createMilestoneInvoice(companyId, userId, milestoneId, { invoice_date } = {}) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // row lock: a second click (or the scheduler) waits here and then sees invoice_id
    const [[m]] = await conn.query(
      `SELECT m.*, i.status AS inv_status FROM payment_plan_milestones m
       LEFT JOIN invoices i ON i.id=m.invoice_id
       WHERE m.id=? AND m.company_id=? FOR UPDATE`,
      [milestoneId, companyId]
    );
    if (!m) throw httpError(404, "Milestone not found");
    if (m.invoice_id && m.inv_status !== "CANCELLED") throw httpError(400, "Is milestone ka invoice pehle se bana hua hai");
    const plan = await getPlanRow(conn, companyId, m.plan_id);
    if (plan.status === "CANCELLED") throw httpError(400, "Plan cancelled hai");
    const [[{ n }]] = await conn.query("SELECT COUNT(*) AS n FROM payment_plan_milestones WHERE plan_id=?", [m.plan_id]);

    const invDate = invoice_date || todayISO();
    const due = m.due_date && String(m.due_date).slice(0, 10) >= invDate ? String(m.due_date).slice(0, 10) : invDate;
    const itemId = plan.item_id || (await findOrCreateMilestoneItem(companyId));
    const pct = m.percent !== null && m.percent !== undefined ? ` (${Number(m.percent)}%)` : "";

    const created = await invoicesService.createInvoice({
      companyId,
      userId,
      payload: {
        customer_id: Number(plan.customer_id),
        invoice_date: invDate,
        due_date: due,
        place_of_supply_state: null,
        is_interstate: 0,
        notes: `Milestone ${m.seq} of ${n}: ${m.title} - ${plan.title}`,
        terms: null,
        items: [
          {
            item_id: Number(itemId),
            qty: 1,
            rate: Number(m.amount),
            billing_months: 1,
            tax_percent: Number(plan.tax_percent),
            discount_percent: 0,
            description: `${plan.title} - ${m.title}${pct}`.slice(0, 480),
          },
        ],
      },
    });

    await conn.query("UPDATE payment_plan_milestones SET invoice_id=? WHERE id=?", [created.invoiceId, m.id]);
    await conn.query(
      "UPDATE invoices SET source_type='PAYMENT_PLAN', source_id=? WHERE id=? AND company_id=?",
      [m.id, created.invoiceId, companyId]
    );
    await writeAudit(conn, {
      companyId, userId, entityType: "PAYMENT_PLAN", entityId: m.plan_id, action: "MILESTONE_INVOICE",
      newValues: { milestone_id: m.id, invoice_id: created.invoiceId },
    });
    await conn.commit();
    return { invoiceId: created.invoiceId };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/* ---------------- demand letter ---------------- */

async function loadMilestoneBundle(companyId, milestoneId) {
  const [[row]] = await pool.query("SELECT plan_id FROM payment_plan_milestones WHERE id=? AND company_id=?", [milestoneId, companyId]);
  if (!row) throw httpError(404, "Milestone not found");
  const { plan, milestones, summary } = await getPlan(companyId, row.plan_id);
  const milestone = milestones.find((x) => Number(x.id) === Number(milestoneId));
  const [[company]] = await pool.query("SELECT * FROM companies WHERE id=?", [companyId]);
  const [[customer]] = await pool.query("SELECT * FROM customers WHERE id=?", [plan.customer_id]);
  return { plan, milestones, summary, milestone, company, customer };
}

/** Amount asked in this demand: invoice balance if invoiced, else installment + GST */
async function demandFigures(companyId, b) {
  const m = b.milestone;
  if (m.invoice_id && m.inv_status !== "CANCELLED") {
    return { taxable: Number(m.amount), tax: r2(Number(m.inv_grand_total) - Number(m.amount)), payable: r2(m.inv_due_total), invoiced: true };
  }
  const supply = await invoicesService.resolveSupply(pool, companyId, b.plan.customer_id, null);
  const tax = r2((Number(m.amount) * Number(b.plan.tax_percent)) / 100);
  return {
    taxable: Number(m.amount),
    tax,
    payable: r2(Number(m.amount) + tax),
    invoiced: false,
    igst: supply.is_interstate === 1,
  };
}

async function ensureDemandNo(companyId, milestoneId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[m]] = await conn.query("SELECT demand_no FROM payment_plan_milestones WHERE id=? FOR UPDATE", [milestoneId]);
    if (m.demand_no) {
      await conn.commit();
      return m.demand_no;
    }
    const fy = getFinancialYear(todayISO());
    const num = await invoicesRepo.nextInvoiceNumber(conn, companyId, fy, DEMAND_PREFIX);
    const no = formatInvoiceNo(DEMAND_PREFIX, fy, num);
    await conn.query("UPDATE payment_plan_milestones SET demand_no=? WHERE id=?", [no, milestoneId]);
    await conn.commit();
    return no;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function generateDemandPdf(companyId, milestoneId) {
  const demandNo = await ensureDemandNo(companyId, milestoneId);
  const b = await loadMilestoneBundle(companyId, milestoneId);
  const { plan, milestones, summary, milestone: m, company, customer } = b;
  const f = await demandFigures(companyId, b);
  const e = pdf.escapeHtml;
  const today = todayISO();

  const scheduleRows = milestones
    .map((x) => {
      const label = { PAID: "Paid", PART_PAID: "Part paid", INVOICED: "Invoiced", OVERDUE: "Overdue", DEMANDED: "Requested", PENDING: "Upcoming" }[x.status];
      const cls = Number(x.id) === Number(m.id) ? ' class="current"' : "";
      return `<tr${cls}>
        <td class="c">${x.seq}</td>
        <td>${e(x.title)}${Number(x.id) === Number(m.id) ? " <b>(this request)</b>" : ""}</td>
        <td class="r">${x.percent !== null ? e(Number(x.percent)) + "%" : ""}</td>
        <td class="r">${e(money(x.amount))}</td>
        <td>${x.due_date ? e(pdf.formatDateShort(x.due_date)) : "On completion"}</td>
        <td>${e(label)}</td>
      </tr>`;
    })
    .join("");

  const qr = await upiQrDataUri({
    upiId: company.upi_id,
    payeeName: company.name,
    amount: f.payable,
    note: `${demandNo} ${plan.title}`.slice(0, 70),
  });
  const logo = pdf.toDataUriFromUploads(company.logo_url);
  const sign = pdf.toDataUriFromUploads(company.signature_url);

  const dueText = m.due_date ? pdf.formatDateShort(m.due_date) : "on completion of this stage";
  const html = fs.readFileSync(path.join(__dirname, "..", "pdf", "templates", "demand_letter.html"), "utf-8");
  const filled = pdf.fillTemplate(html, {
    companyLogo: logo ? `<img src="${logo}" alt="logo" />` : "",
    companySignature: sign ? `<img src="${sign}" alt="signature" />` : "",
    upiQr: qr ? `<div class="upiQr"><img src="${qr}" alt="UPI QR" /><div class="cap">Scan to pay ${e(money(f.payable))}</div></div>` : "",
    scheduleRows,
    taxLine: f.invoiced
      ? `<div class="sumRow"><span class="muted">GST (as per invoice ${e(m.invoice_no || "")})</span><span>${e(money(f.tax))}</span></div>`
      : `<div class="sumRow"><span class="muted">${f.igst ? "IGST" : "CGST + SGST"} @ ${e(Number(plan.tax_percent))}%</span><span>${e(money(f.tax))}</span></div>`,
    invoiceNote: f.invoiced
      ? `Tax invoice ${e(m.invoice_no || "#" + m.invoice_id)} has been issued for this installment.`
      : "This is a payment request, not a tax invoice. The GST tax invoice for this installment will be issued on or before the due date.",

    "company.name": e(company.name),
    "company.legal_name": e(company.legal_name),
    "company.gstin": e(company.gstin),
    "company.address": e([company.billing_address_line1, company.billing_address_line2, company.billing_city, company.billing_state, company.billing_pincode].filter(Boolean).join(", ")),
    "company.contact": [company.gstin ? `GSTIN: ${e(company.gstin)}` : "", e(company.phone), e(company.email)]
      .filter(Boolean)
      .join(" &nbsp;|&nbsp; "),
    "company.bank_name": e(company.bank_name),
    "company.bank_account_no": e(company.bank_account_no),
    "company.bank_ifsc": e(company.bank_ifsc),
    "company.upi_id": e(company.upi_id),

    "customer.name": e(customer.name),
    "customer.contact": e(customer.contact_person || ""),
    "customer.address": e([customer.billing_address_line1, customer.billing_city, customer.billing_state, customer.billing_pincode].filter(Boolean).join(", ")),
    "customer.gstin": e(customer.gstin || "-"),

    "demand.no": e(demandNo),
    "demand.date": e(pdf.formatDateShort(today)),
    "demand.due": e(dueText),
    "demand.taxable": e(money(f.taxable)),
    "demand.payable": e(money(f.payable)),

    "plan.title": e(plan.title),
    "plan.total": e(money(summary.total_payable)),
    "plan.received": e(money(summary.received)),
    "plan.balance_after": e(money(Math.max(0, summary.total_payable - summary.received - f.payable))),
    "m.seq": e(m.seq),
    "m.count": e(milestones.length),
    "m.title": e(m.title),
  });

  return { pdf: await pdf.htmlToPdfBuffer(filled), demandNo, bundle: b, figures: f };
}

async function markDemanded(milestoneId) {
  await pool.query(
    "UPDATE payment_plan_milestones SET demand_count=demand_count+1, last_demand_at=NOW() WHERE id=?",
    [milestoneId]
  );
}

async function portalUrlFor(companyId, customerId) {
  if (!portalTokens.isPublicUrlConfigured()) return null;
  return portalTokens.portalUrl(await portalTokens.getOrCreateToken(companyId, customerId));
}

function demandEmailHtml({ company, customer, plan, milestone: m, milestones }, figures, demandNo, message, portalUrl, isReminder) {
  const e = pdf.escapeHtml;
  const due = m.due_date ? pdf.formatDateShort(m.due_date) : "on completion of this stage";
  const intro = isReminder
    ? `This is a reminder that installment <b>${m.seq} of ${milestones.length}</b> for <b>${e(plan.title)}</b> is pending.`
    : `As per our agreement for <b>${e(plan.title)}</b>, installment <b>${m.seq} of ${milestones.length}</b> (${e(m.title)}) is now due.`;
  return `
<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111;max-width:600px;margin:0 auto;">
  <div style="padding:14px 0;border-bottom:2px solid #111;font-size:18px;font-weight:bold;">${e(company.name)}</div>
  <div style="padding:16px 0;line-height:1.55;">
    <p>Dear ${e(customer.contact_person || customer.name)},</p>
    ${message ? `<p>${e(message).replaceAll("\n", "<br/>")}</p>` : ""}
    <p>${intro}</p>
    <table style="border-collapse:collapse;margin:10px 0;">
      <tr><td style="padding:4px 16px 4px 0;color:#555;">Demand no.</td><td><b>${e(demandNo)}</b></td></tr>
      <tr><td style="padding:4px 16px 4px 0;color:#555;">Amount payable</td><td><b>${e(money(figures.payable))}</b>${figures.invoiced ? "" : " (incl. GST)"}</td></tr>
      <tr><td style="padding:4px 16px 4px 0;color:#555;">Please pay by</td><td><b>${e(due)}</b></td></tr>
    </table>
    ${portalUrl ? `<p style="margin:18px 0;"><a href="${e(portalUrl)}" style="background:#111;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;display:inline-block;font-weight:bold;">View account & pay online</a></p>` : ""}
    <p>The payment request letter with bank details and UPI QR code is attached.</p>
    <p>Thank you.</p>
  </div>
</div>`;
}

async function sendDemandEmail(companyId, userId, milestoneId, { to, cc, message, isReminder = false } = {}) {
  const out = await generateDemandPdf(companyId, milestoneId);
  const b = out.bundle;
  const recipient = String(to || b.customer.email || "").trim();
  if (!recipient) throw httpError(400, "Customer ki email nahi hai. Customer mein email add karein.");
  const portalUrl = await portalUrlFor(companyId, b.plan.customer_id);

  await sendMail({
    fromName: b.company.name,
    to: recipient,
    cc: cc || undefined,
    replyTo: b.company.email || undefined,
    subject: `${isReminder ? "Reminder: " : ""}Payment request ${out.demandNo} - ${b.plan.title} (installment ${b.milestone.seq}/${b.milestones.length}) - ${money(out.figures.payable)}`,
    html: demandEmailHtml(b, out.figures, out.demandNo, message, portalUrl, isReminder),
    attachments: [{ filename: `${out.demandNo.replace(/[^\w.-]+/g, "_")}.pdf`, content: Buffer.from(out.pdf) }],
  });
  await markDemanded(milestoneId);
  await writeAudit(pool, {
    companyId, userId, entityType: "PAYMENT_PLAN", entityId: b.plan.id, action: "DEMAND_EMAIL",
    newValues: { milestone_id: milestoneId, demand_no: out.demandNo, to: recipient, amount: out.figures.payable },
  });
  return { sent: true, to: recipient, demand_no: out.demandNo };
}

async function demandWhatsapp(companyId, userId, milestoneId) {
  const demandNo = await ensureDemandNo(companyId, milestoneId);
  const b = await loadMilestoneBundle(companyId, milestoneId);
  const f = await demandFigures(companyId, b);
  const m = b.milestone;
  let digits = String(b.customer.phone || "").replace(/\D/g, "").replace(/^0+/, "");
  if (digits.length === 10) digits = `91${digits}`;
  const portalUrl = await portalUrlFor(companyId, b.plan.customer_id);

  const lines = [
    `Dear ${b.customer.contact_person || b.customer.name},`,
    ``,
    `Payment request *${demandNo}* for *${b.plan.title}*`,
    `Installment ${m.seq} of ${b.milestones.length}: ${m.title}`,
    `Amount payable: *${money(f.payable)}*${f.invoiced ? "" : " (incl. GST)"}`,
    `Please pay by: *${m.due_date ? pdf.formatDateShort(m.due_date) : "on completion of this stage"}*`,
  ];
  if (b.company.upi_id) lines.push(``, `UPI: *${b.company.upi_id}*`);
  if (portalUrl) lines.push(``, `View & pay online: ${portalUrl}`);
  lines.push(``, `Thank you!`, b.company.name);

  await markDemanded(milestoneId);
  await writeAudit(pool, {
    companyId, userId, entityType: "PAYMENT_PLAN", entityId: b.plan.id, action: "DEMAND_WHATSAPP",
    newValues: { milestone_id: milestoneId, demand_no: demandNo },
  });
  return { url: `https://wa.me/${digits.length >= 11 ? digits : ""}?text=${encodeURIComponent(lines.join("\n"))}`, demand_no: demandNo };
}

/* ---------------- daily automation ---------------- */

/** Runs one action once per key; returns "sent" | "skipped" | "failed" */
async function once(key, fn) {
  const logId = await notifRepo.claim(key);
  if (!logId) return "skipped";
  try {
    const recipient = await fn();
    await notifRepo.markSent(logId, recipient, recipient === null ? "SKIPPED" : "SENT");
    return recipient === null ? "skipped" : "sent";
  } catch (e) {
    await notifRepo.markFailed(logId, e.message);
    console.warn(`[payment-plans] ${key.kind} #${key.entityId} failed:`, e.message);
    return "failed";
  }
}

async function runMilestoneAutomation(companyId, settings, { mailOk }) {
  const out = { invoices_created: 0, demands_sent: 0, failed: 0 };
  if (!settings.milestone_auto_invoice && !(settings.milestone_demands && mailOk)) return out;

  const days = Number(settings.milestone_demand_days ?? 7);
  const [rows] = await pool.query(
    `SELECT m.id, m.due_date, m.demand_count, DATEDIFF(m.due_date, CURDATE()) AS days_left, c.email AS customer_email,
            i.status AS inv_status, i.due_total AS inv_due_total
     FROM payment_plan_milestones m
     JOIN payment_plans p ON p.id=m.plan_id AND p.status='ACTIVE'
     JOIN customers c ON c.id=p.customer_id
     LEFT JOIN invoices i ON i.id=m.invoice_id
     WHERE m.company_id=? AND m.due_date IS NOT NULL
       AND DATEDIFF(m.due_date, CURDATE()) <= ?`,
    [companyId, days]
  );

  for (const r of rows) {
    const due = String(r.due_date).slice(0, 10);
    const hasInvoice = r.inv_status && r.inv_status !== "CANCELLED";
    const paid = hasInvoice && Number(r.inv_due_total) <= 0;
    if (paid) continue;

    // GST: the tax invoice is due on the installment's due date
    if (settings.milestone_auto_invoice && !hasInvoice && Number(r.days_left) <= 0) {
      const res = await once(
        { companyId, kind: "MILESTONE_INVOICE", entityType: "MILESTONE", entityId: r.id, refKey: `due-${due}`, channel: "SYSTEM" },
        async () => `invoice #${(await createMilestoneInvoice(companyId, null, r.id)).invoiceId}`
      );
      if (res === "sent") out.invoices_created++;
      else if (res === "failed") out.failed++;
    }

    if (settings.milestone_demands && mailOk) {
      // one request before the due date, one reminder 3+ days after it
      const overdue = Number(r.days_left) <= -3;
      const res = await once(
        { companyId, kind: "MILESTONE_DEMAND", entityType: "MILESTONE", entityId: r.id, refKey: `${overdue ? "overdue" : "due"}-${due}` },
        async () => {
          if (!r.customer_email) return null;
          if (!overdue && Number(r.demand_count) > 0) return null; // already requested by hand
          const sent = await sendDemandEmail(companyId, null, r.id, { isReminder: overdue });
          return sent.to;
        }
      );
      if (res === "sent") out.demands_sent++;
      else if (res === "failed") out.failed++;
    }
  }
  return out;
}

module.exports = {
  splitMilestones,
  listPlans,
  getPlan,
  createPlan,
  updatePlan,
  cancelPlan,
  createMilestoneInvoice,
  generateDemandPdf,
  sendDemandEmail,
  demandWhatsapp,
  runMilestoneAutomation,
};
