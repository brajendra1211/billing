const pool = require("../../config/db");
const repo = require("./payments.repository");

// ✅ use invoices repo to generate invoice_no in same transaction
const invoicesRepo = require("../invoices/invoices.repository");
const { getFinancialYear, formatInvoiceNo } = require("../../utils/invoice");
const { writeAudit } = require("../../utils/audit");

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

const PREFIX = "UIS";

async function listByInvoice(companyId, invoiceId) {
  return repo.listByInvoice(companyId, invoiceId);
}

async function addToInvoice({ companyId, userId, invoiceId, payload }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // ✅ lock invoice row (FOR UPDATE in repo)
    const inv = await repo.getInvoiceForPayment(conn, companyId, invoiceId);
    if (!inv) {
      const err = new Error("Invoice not found");
      err.statusCode = 404;
      throw err;
    }

    const invStatus = String(inv.status || "").toUpperCase();

    if (invStatus === "CANCELLED") {
      const err = new Error("Cannot add payment to CANCELLED invoice");
      err.statusCode = 400;
      throw err;
    }

    const amount = round2(payload.amount);
    if (!(amount > 0)) {
      const err = new Error("Amount must be > 0");
      err.statusCode = 400;
      throw err;
    }

    const beforePaymentTotals = await repo.sumPaymentsForInvoice(conn, companyId, invoiceId);
    const currentPaid = round2(beforePaymentTotals.paid_total || 0);
    const currentDue = round2(Number(inv.grand_total || 0) - currentPaid);

    if (currentDue <= 0) {
      const err = new Error("Invoice is already fully paid");
      err.statusCode = 400;
      throw err;
    }

    if (amount > currentDue) {
      const err = new Error(`Amount cannot be more than due amount (${currentDue})`);
      err.statusCode = 400;
      throw err;
    }

    // 1) create payment
    const paymentId = await repo.insertPayment(conn, {
      company_id: companyId,
      invoice_id: invoiceId,
      payment_date: payload.payment_date,
      amount,
      mode: payload.mode,
      reference_no: payload.reference_no || null,
      notes: payload.notes || null,
      created_by: userId,
    });
    await writeAudit(conn, {
      companyId,
      userId,
      entityType: "PAYMENT",
      entityId: paymentId,
      action: "CREATE",
      newValues: { invoice_id: invoiceId, amount, mode: payload.mode },
    });

    // 2) recompute invoice paid/due
    const totals = await repo.sumPaymentsForInvoice(conn, companyId, invoiceId);
    const paid_total = round2(totals.paid_total || 0);

    let due_total = round2(Number(inv.grand_total) - paid_total);
    if (due_total < 0) due_total = 0;

    await repo.updateInvoicePaidDue(conn, {
      companyId,
      invoiceId,
      paid_total,
      due_total,
      updated_by: userId,
    });

    /**
     * 3) ✅ FIXED BUSINESS RULE
     * - Partial payment: keep invoice as DRAFT (or set PARTIAL if you want)
     * - Full payment (due_total == 0): generate invoice_no + set status FINAL
     */
    if (due_total <= 0) {
      // Lock again via invoicesRepo (safe) and ensure invoice_no exists
      const lockedInv = await invoicesRepo.getByIdForUpdate(conn, companyId, invoiceId);
      if (!lockedInv) {
        const err = new Error("Invoice not found");
        err.statusCode = 404;
        throw err;
      }

      if (String(lockedInv.status || "").toUpperCase() !== "CANCELLED") {
        // Generate invoice_no only if missing
        if (!lockedInv.invoice_no) {
          const fy = lockedInv.financial_year || getFinancialYear(lockedInv.invoice_date);
          const nextNum = await invoicesRepo.nextInvoiceNumber(conn, companyId, fy, PREFIX);
          const invoiceNo = formatInvoiceNo(PREFIX, fy, nextNum);

          // ✅ sets invoice_number, invoice_no, status FINAL
          await invoicesRepo.finalizeInvoice(conn, invoiceId, companyId, nextNum, invoiceNo);
        } else {
          // already has invoice_no, just ensure FINAL (optional)
          await repo.updateInvoiceStatus(conn, {
            companyId,
            invoiceId,
            status: "FINAL",
            updated_by: userId,
          });
        }
      }
    } else {
      // ✅ Partial payment: keep as DRAFT (recommended per your requirement)
      // If your system had set FINAL wrongly earlier, you can force back to DRAFT:
      if (invStatus === "FINAL" && !inv.invoice_no) {
        await repo.updateInvoiceStatus(conn, {
          companyId,
          invoiceId,
          status: "DRAFT",
          updated_by: userId,
        });
      }

      // If you want "PARTIAL" status:
      // await repo.updateInvoiceStatus(conn, { companyId, invoiceId, status: "PARTIAL", updated_by: userId });
    }

    await conn.commit();
    return { paymentId, paid_total, due_total };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

module.exports = {
  listByInvoice,
  addToInvoice,
};
