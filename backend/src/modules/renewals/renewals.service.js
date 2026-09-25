const pool = require("../../config/db");
const repo = require("./renewals.repository");
const invoicesService = require("../invoices/invoices.service");
const { writeAudit } = require("../../utils/audit");

// ✅ ADD THIS
function isISODate(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
}

function toISO(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// ✅ Replace your addMonths with this safe version
function addMonths(dateStr, months) {
  if (!isISODate(dateStr)) return null;
  const d = new Date(dateStr + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null;

  d.setMonth(d.getMonth() + Number(months || 0));
  return toISO(d);
}

function calcNextDue(baseDate, cycle) {
  const c = String(cycle || "YEARLY").toUpperCase();
  if (c === "MONTHLY") return addMonths(baseDate, 1);
  if (c === "QUARTERLY") return addMonths(baseDate, 3);
  if (c === "HALF_YEARLY") return addMonths(baseDate, 6);
  return addMonths(baseDate, 12);
}

async function addPayment({ companyId, userId, recurringId, body }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // ✅ validate paid_date
    if (!isISODate(body.paid_date)) {
      const err = new Error("Invalid paid_date (YYYY-MM-DD required)");
      err.statusCode = 400;
      throw err;
    }

    // ✅ lock renewal row inside transaction
    const r = await repo.getRenewalForUpdate(conn, companyId, recurringId);
    if (!r) {
      const err = new Error("Renewal not found");
      err.statusCode = 404;
      throw err;
    }

    await repo.insertPayment(conn, companyId, userId, recurringId, body);
    await writeAudit(conn, {
      companyId,
      userId,
      entityType: "RENEWAL",
      entityId: recurringId,
      action: "PAYMENT",
      newValues: { amount: body.amount, paid_date: body.paid_date, mode: body.mode },
    });

    // ✅ base date fallback: next_due_date -> start_date -> paid_date
    const base =
      (isISODate(r.next_due_date) && r.next_due_date) ||
      (isISODate(r.start_date) && r.start_date) ||
      body.paid_date;

    const next = calcNextDue(base, r.cycle);

    if (!next) {
      const err = new Error("Failed to compute next due date (invalid base date)");
      err.statusCode = 400;
      throw err;
    }

    await repo.updateNextDue(conn, companyId, recurringId, {
      last_paid_date: body.paid_date,
      next_due_date: next,
    });

    await conn.commit();
    return { next_due_date: next };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function createInvoiceFromRenewal({ companyId, userId, recurringId, body }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const renewal = await repo.getRenewalForUpdate(conn, companyId, recurringId);
    if (!renewal) {
      const err = new Error("Renewal not found");
      err.statusCode = 404;
      throw err;
    }
    if (!renewal.customer_id) {
      const err = new Error("Renewal must have a customer before invoice can be created");
      err.statusCode = 400;
      throw err;
    }

    const itemId = body.item_id || (await repo.findOrCreateRenewalItem(conn, companyId));
    await conn.commit();

    const invoiceDate = body.invoice_date || todayISO();
    const description = [
      renewal.name,
      renewal.service_ref ? `(${renewal.service_ref})` : "",
      renewal.cycle ? `- ${renewal.cycle}` : "",
    ].filter(Boolean).join(" ");

    const created = await invoicesService.createInvoice({
      companyId,
      userId,
      payload: {
        customer_id: Number(renewal.customer_id),
        invoice_date: invoiceDate,
        due_date: body.due_date || renewal.next_due_date || null,
        place_of_supply_state: null,
        is_interstate: 0,
        notes: body.notes || renewal.notes || `Generated from renewal #${renewal.id}`,
        terms: null,
        items: [
          {
            item_id: Number(itemId),
            qty: 1,
            rate: Number(renewal.amount || 0),
            tax_percent: Number(body.tax_percent ?? 18),
            discount_percent: 0,
            description,
          },
        ],
      },
    });

    const conn2 = await pool.getConnection();
    try {
      await conn2.beginTransaction();
      await conn2.query(
        `UPDATE invoices
         SET source_type='RENEWAL', source_id=?, updated_at=NOW()
         WHERE company_id=? AND id=?`,
        [recurringId, companyId, created.invoiceId]
      );
      await repo.markInvoiceCreated(conn2, companyId, recurringId, created.invoiceId, invoiceDate);
      await writeAudit(conn2, {
        companyId,
        userId,
        entityType: "RENEWAL",
        entityId: recurringId,
        action: "CREATE_INVOICE",
        newValues: { invoice_id: created.invoiceId },
      });
      await conn2.commit();
    } catch (e) {
      await conn2.rollback();
      throw e;
    } finally {
      conn2.release();
    }

    return created;
  } catch (e) {
    try {
      await conn.rollback();
    } catch {}
    throw e;
  } finally {
    conn.release();
  }
}

module.exports = {
  listRenewals: repo.listRenewals,
  createRenewal: repo.createRenewal,
  getRenewal: repo.getRenewal,
  updateRenewal: repo.updateRenewal,
  listPayments: repo.listPayments,
  addPayment,
  dashboardAlerts: repo.dashboardAlerts,
  createInvoiceFromRenewal,
};
