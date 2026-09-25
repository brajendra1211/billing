const pool = require("../../config/db");
const repo = require("./invoices.repository");
const { getFinancialYear, formatInvoiceNo } = require("../../utils/invoice");
const { writeAudit } = require("../../utils/audit");
const { assertOwned } = require("../../utils/ownership");
const gst = require("../../utils/gst");

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

const PREFIX = "UIS";

function cleanBillingNote(description) {
  return String(description || "")
    .replace(/\s*\|\s*Billing:\s*.*$/i, "")
    .trim();
}

function withBillingNote(description, qty, billingMonths, rate) {
  const baseDescription = cleanBillingNote(description);
  if (billingMonths <= 1) return baseDescription;

  const note = `Billing: ${qty} x ${billingMonths} months @ ${rate}/month`;
  return `${baseDescription || "Service"} | ${note}`;
}

/**
 * Compute totals + prepare invoice_items rows from payload.items
 */
async function computeInvoiceLinesAndTotals(companyId, payload) {
  let subtotal = 0,
    discount_total = 0,
    taxable_total = 0;
  let cgst_total = 0,
    sgst_total = 0,
    igst_total = 0;

  const lineRows = [];

  for (const it of payload.items) {
    const master = await repo.getItemById(companyId, it.item_id);
    if (!master) {
      const err = new Error(`Item not found: ${it.item_id}`);
      err.statusCode = 400;
      throw err;
    }

    const qty = Number(it.qty || 1);
    const rate = Number(it.rate ?? master.sale_price ?? 0);
    const tax_percent = Number(it.tax_percent ?? master.tax_percent ?? 18);
    const billing_months = Math.max(1, Number(it.billing_months || 1));
    const discount_percent = Number(it.discount_percent || 0);

    const base = round2(qty * rate * billing_months);
    const discAmt = round2((base * discount_percent) / 100);
    const taxable = round2(base - discAmt);

    let cgst = 0,
      sgst = 0,
      igst = 0;

    if (Number(payload.is_interstate) === 1) {
      igst = round2((taxable * tax_percent) / 100);
    } else {
      const half = tax_percent / 2;
      cgst = round2((taxable * half) / 100);
      sgst = round2((taxable * half) / 100);
    }

    const line_total = round2(taxable + cgst + sgst + igst);

    subtotal = round2(subtotal + base);
    discount_total = round2(discount_total + discAmt);
    taxable_total = round2(taxable_total + taxable);
    cgst_total = round2(cgst_total + cgst);
    sgst_total = round2(sgst_total + sgst);
    igst_total = round2(igst_total + igst);

    lineRows.push({
      invoice_id: null, // set later
      item_id: master.id,
      type: master.type,
      description: withBillingNote(it.description || master.name, qty, billing_months, rate),
      hsn_sac: master.hsn_sac,
      unit: master.unit || "Nos",
      qty,
      billing_months,
      rate,
      discount_percent,
      discount_amount: discAmt,
      tax_percent,
      taxable_amount: taxable,
      cgst_amount: cgst,
      sgst_amount: sgst,
      igst_amount: igst,
      line_total,
    });
  }

  const grand_total = round2(taxable_total + cgst_total + sgst_total + igst_total);

  return {
    totals: {
      subtotal,
      discount_total,
      taxable_total,
      cgst_total,
      sgst_total,
      igst_total,
      round_off: 0,
      grand_total,
    },
    lineRows,
  };
}

/**
 * GST rule: IGST when place of supply is a different state from the company's
 * state, CGST+SGST when it's the same. Place of supply defaults to the
 * customer's GSTIN state (registered) or billing state.
 * strict: the place of supply was typed by the user, so reject unknown values.
 */
async function resolveSupply(db, companyId, customerId, requestedPos, { strict = true } = {}) {
  const [[company]] = await db.query("SELECT gstin, billing_state FROM companies WHERE id=?", [companyId]);
  const [[customer]] = await db.query(
    "SELECT gstin, billing_state FROM customers WHERE id=? AND company_id=?",
    [customerId, companyId]
  );

  let posCode = requestedPos ? gst.stateCode(requestedPos) : null;
  if (requestedPos && !posCode && strict) {
    const err = new Error(`Place of supply "${requestedPos}" pehchana nahi gaya. List se state chunein.`);
    err.statusCode = 400;
    throw err;
  }
  if (!posCode) posCode = gst.customerStateCode(customer);

  const companyCode = gst.companyStateCode(company);
  return {
    place_of_supply_state: posCode ? gst.stateName(posCode) : null,
    // null = can't decide (state unknown) -> keep what the user chose
    is_interstate: posCode && companyCode ? (posCode !== companyCode ? 1 : 0) : null,
  };
}

/**
 * CREATE invoice as DRAFT (no finalize)
 */
async function createInvoice({ companyId, userId, payload }) {
  const fy = getFinancialYear(payload.invoice_date);

  await assertOwned(pool, "customers", companyId, payload.customer_id, "Customer");

  const supply = await resolveSupply(pool, companyId, payload.customer_id, payload.place_of_supply_state);
  payload = {
    ...payload,
    place_of_supply_state: supply.place_of_supply_state,
    is_interstate: supply.is_interstate ?? (Number(payload.is_interstate) === 1 ? 1 : 0),
  };

  const { totals, lineRows } = await computeInvoiceLinesAndTotals(companyId, payload);

  const paid_total = 0;
  const due_total = totals.grand_total;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const invoiceId = await repo.createInvoiceHeader(conn, {
      company_id: companyId,
      customer_id: payload.customer_id,
      financial_year: fy,
      prefix: PREFIX,

      invoice_date: payload.invoice_date,
      due_date: payload.due_date || null,
      place_of_supply_state: payload.place_of_supply_state || null,
      is_interstate: Number(payload.is_interstate) === 1 ? 1 : 0,
      notes: payload.notes || null,
      terms: payload.terms || null,

      ...totals,
      paid_total,
      due_total,

      status: "DRAFT",
      created_by: userId,
      updated_by: userId,
    });

    for (const r of lineRows) {
      r.invoice_id = invoiceId;
      await repo.insertInvoiceItem(conn, r);
    }

    await conn.commit();
    await writeAudit(pool, {
      companyId,
      userId,
      entityType: "INVOICE",
      entityId: invoiceId,
      action: "CREATE",
      newValues: { grand_total: totals.grand_total, due_total },
    });
    return { invoiceId };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/**
 * UPDATE invoice (DRAFT only)
 * This replaces header + deletes and re-inserts items (simple and reliable)
 */
async function updateInvoice({ companyId, userId, invoiceId, patch }) {
  // If items not provided, keep existing items? For simplicity we require items when updating totals
  // You can change later.
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // lock invoice row
    const [invRows] = await conn.query(
      "SELECT * FROM invoices WHERE id=? AND company_id=? FOR UPDATE",
      [invoiceId, companyId]
    );
    const inv = invRows[0];
    if (!inv) {
      const err = new Error("Invoice not found");
      err.statusCode = 404;
      throw err;
    }

    if (inv.status !== "DRAFT") {
      const err = new Error("Invoice locked. Only DRAFT invoice can be edited.");
      err.statusCode = 400;
      throw err;
    }

    if (patch.customer_id !== undefined) {
      await assertOwned(conn, "customers", companyId, patch.customer_id, "Customer");
    }

    // Re-derive place of supply / IGST whenever anything affecting it changes
    const has = (k) => Object.prototype.hasOwnProperty.call(patch, k);
    if (has("customer_id") || has("place_of_supply_state") || has("is_interstate") || Array.isArray(patch.items)) {
      const customerId = patch.customer_id ?? inv.customer_id;
      const customerChanged = has("customer_id") && Number(patch.customer_id) !== Number(inv.customer_id);
      const userPos = has("place_of_supply_state") ? patch.place_of_supply_state : null;
      const inheritedPos = !has("place_of_supply_state") && !customerChanged ? inv.place_of_supply_state : null;
      const supply = await resolveSupply(conn, companyId, customerId, userPos || inheritedPos, { strict: Boolean(userPos) });
      patch = { ...patch, place_of_supply_state: supply.place_of_supply_state };
      if (supply.is_interstate !== null) patch.is_interstate = supply.is_interstate;
    }

    // Interstate flag change needs CGST/SGST <-> IGST recompute, so reuse stored lines
    const interstateChanged =
      patch.is_interstate !== undefined &&
      Number(patch.is_interstate) !== Number(inv.is_interstate);
    if (!Array.isArray(patch.items) && interstateChanged) {
      const [existing] = await conn.query(
        "SELECT * FROM invoice_items WHERE invoice_id=? ORDER BY id ASC",
        [invoiceId]
      );
      patch = {
        ...patch,
        items: existing.map((r) => ({
          item_id: r.item_id,
          qty: Number(r.qty),
          rate: Number(r.rate),
          billing_months: Number(r.billing_months || 1),
          discount_percent: Number(r.discount_percent || 0),
          tax_percent: Number(r.tax_percent),
          description: r.description,
        })),
      };
    }

    // build new payload for recompute if items provided
    let totals = null;
    let lineRows = null;

    const hasItems = Array.isArray(patch.items);
    if (hasItems) {
      const recomputePayload = {
        ...inv,
        ...patch,
        items: patch.items,
        is_interstate: patch.is_interstate ?? inv.is_interstate,
      };
      const out = await computeInvoiceLinesAndTotals(companyId, recomputePayload);
      totals = out.totals;
      lineRows = out.lineRows;
    }

    // update header fields
    const fields = [];
    const values = [];

    const headerAllowed = [
      "customer_id",
      "invoice_date",
      "due_date",
      "place_of_supply_state",
      "is_interstate",
      "notes",
      "terms",
    ];

    for (const k of headerAllowed) {
      if (Object.prototype.hasOwnProperty.call(patch, k)) {
        fields.push(`${k}=?`);
        values.push(patch[k]);
      }
    }

    if (patch.invoice_date) {
      fields.push("financial_year=?");
      values.push(getFinancialYear(patch.invoice_date));
    }

    // totals update if items changed
    if (hasItems && totals) {
      fields.push("subtotal=?"); values.push(totals.subtotal);
      fields.push("discount_total=?"); values.push(totals.discount_total);
      fields.push("taxable_total=?"); values.push(totals.taxable_total);
      fields.push("cgst_total=?"); values.push(totals.cgst_total);
      fields.push("sgst_total=?"); values.push(totals.sgst_total);
      fields.push("igst_total=?"); values.push(totals.igst_total);
      fields.push("round_off=?"); values.push(totals.round_off);
      fields.push("grand_total=?"); values.push(totals.grand_total);

      const paidTotal = Number(inv.paid_total || 0);
      if (Number(totals.grand_total) < paidTotal) {
        const err = new Error("Invoice total cannot be less than payments already received.");
        err.statusCode = 400;
        throw err;
      }

      // paid_total stays same, due_total = grand - paid
      const newDue = Math.max(0, round2(Number(totals.grand_total) - paidTotal));
      fields.push("due_total=?"); values.push(newDue);
    }

    fields.push("updated_by=?");
    values.push(userId);

    fields.push("updated_at=NOW()");

    if (fields.length > 0) {
      await conn.query(
        `UPDATE invoices SET ${fields.join(", ")} WHERE id=? AND company_id=?`,
        [...values, invoiceId, companyId]
      );
    }

    // replace items if items provided
    if (hasItems) {
      await conn.query("DELETE FROM invoice_items WHERE invoice_id=?", [invoiceId]);
      for (const r of lineRows) {
        r.invoice_id = invoiceId;
        await repo.insertInvoiceItem(conn, r);
      }
    }

    await conn.commit();
    await writeAudit(pool, {
      companyId,
      userId,
      entityType: "INVOICE",
      entityId: invoiceId,
      action: "UPDATE",
      oldValues: { status: inv.status, grand_total: inv.grand_total, due_total: inv.due_total },
      newValues: hasItems && totals ? { grand_total: totals.grand_total } : patch,
    });
    return { invoiceId };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/**
 * FINALIZE invoice (DRAFT -> FINAL)
 * Uses your existing series method: repo.nextInvoiceNumber + repo.finalizeInvoice
 */
async function finalizeInvoice({ companyId, userId, invoiceId }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [invRows] = await conn.query(
      "SELECT * FROM invoices WHERE id=? AND company_id=? FOR UPDATE",
      [invoiceId, companyId]
    );
    const inv = invRows[0];
    if (!inv) {
      const err = new Error("Invoice not found");
      err.statusCode = 404;
      throw err;
    }

    if (inv.status === "CANCELLED") {
      const err = new Error("Cancelled invoice cannot be finalized");
      err.statusCode = 400;
      throw err;
    }

    // Invoice numbers are never reissued: a FINAL invoice keeps its number (GST series must be gapless)
    if (inv.status === "FINAL") {
      await conn.commit();
      return { status: "FINAL", invoice_no: inv.invoice_no };
    }

    // must have total > 0
    if (Number(inv.grand_total || 0) <= 0) {
      const err = new Error("Invoice total must be > 0 to finalize");
      err.statusCode = 400;
      throw err;
    }

    const fy = inv.financial_year || getFinancialYear(inv.invoice_date);
    const nextNum = await repo.nextInvoiceNumber(conn, companyId, fy, PREFIX);
    const invoiceNo = formatInvoiceNo(PREFIX, fy, nextNum);

    // ✅ existing repo method (you already have it)
    await repo.finalizeInvoice(conn, invoiceId, companyId, nextNum, invoiceNo);
    await writeAudit(conn, {
      companyId,
      userId,
      entityType: "INVOICE",
      entityId: invoiceId,
      action: "FINALIZE",
      oldValues: { status: inv.status, invoice_no: inv.invoice_no },
      newValues: { status: "FINAL", invoice_no: invoiceNo },
    });

    await conn.commit();
    return { status: "FINAL", invoice_no: invoiceNo };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/**
 * CANCEL invoice (recommended: only if no payments)
 */
async function cancelInvoice({ companyId, userId, invoiceId, reason }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [invRows] = await conn.query(
      "SELECT * FROM invoices WHERE id=? AND company_id=? FOR UPDATE",
      [invoiceId, companyId]
    );
    const inv = invRows[0];
    if (!inv) {
      const err = new Error("Invoice not found");
      err.statusCode = 404;
      throw err;
    }

    if (inv.status === "FINAL") {
      const err = new Error("Final invoice cancel nahi ho sakta. Iske liye Credit Note banayein.");
      err.statusCode = 400;
      throw err;
    }

    if (inv.status === "CANCELLED") {
      await conn.commit();
      return { status: "CANCELLED" };
    }

    // block if payments exist
    const [payRows] = await conn.query(
      "SELECT COUNT(*) AS cnt FROM payments WHERE invoice_id=?",
      [invoiceId]
    );
    const cnt = Number(payRows[0]?.cnt || 0);
    if (cnt > 0) {
      const err = new Error("Cannot cancel invoice with payments. Remove/refund payments first.");
      err.statusCode = 400;
      throw err;
    }

    await conn.query(
      `UPDATE invoices
       SET status='CANCELLED', cancelled_at=NOW(), cancelled_reason=?, updated_at=NOW()
       WHERE id=? AND company_id=?`,
      [reason, invoiceId, companyId]
    );
    await writeAudit(conn, {
      companyId,
      userId,
      entityType: "INVOICE",
      entityId: invoiceId,
      action: "CANCEL",
      oldValues: { status: inv.status },
      newValues: { status: "CANCELLED", reason },
    });

    await conn.commit();
    return { status: "CANCELLED" };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function getInvoice(companyId, invoiceId) {
  return repo.getInvoice(companyId, invoiceId);
}

async function listInvoices(companyId) {
  return repo.listInvoices(companyId);
}

// Optional backward compatibility (if any old code calls it)
async function createAndFinalizeInvoice({ companyId, userId, payload }) {
  const created = await createInvoice({ companyId, userId, payload });
  const finalized = await finalizeInvoice({ companyId, invoiceId: created.invoiceId });
  return { invoiceId: created.invoiceId, invoiceNo: finalized.invoice_no };
}
async function listInvoicesFiltered(companyId, query) {
  return repo.listInvoicesFiltered(companyId, query);
}

async function markSent({ companyId, userId, invoiceId, body }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const inv = await repo.getByIdForUpdate(conn, companyId, invoiceId);
    if (!inv) {
      const err = new Error("Invoice not found");
      err.statusCode = 404;
      throw err;
    }
    if (inv.status === "CANCELLED") {
      const err = new Error("Cancelled invoice cannot be marked sent");
      err.statusCode = 400;
      throw err;
    }

    await repo.markInvoiceSent(conn, companyId, invoiceId, body.channel);
    await writeAudit(conn, {
      companyId,
      userId,
      entityType: "INVOICE",
      entityId: invoiceId,
      action: "MARK_SENT",
      oldValues: { sent_at: inv.sent_at },
      newValues: { channel: body.channel },
    });

    await conn.commit();
    return { sent: true };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function addReminder({ companyId, userId, invoiceId, body }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const inv = await repo.getByIdForUpdate(conn, companyId, invoiceId);
    if (!inv) {
      const err = new Error("Invoice not found");
      err.statusCode = 404;
      throw err;
    }
    if (Number(inv.due_total || 0) <= 0) {
      const err = new Error("Cannot add reminder for fully paid invoice");
      err.statusCode = 400;
      throw err;
    }

    const reminderId = await repo.insertReminder(conn, {
      companyId,
      invoiceId,
      userId,
      reminderDate: body.reminder_date,
      channel: body.channel,
      note: body.note,
    });
    await writeAudit(conn, {
      companyId,
      userId,
      entityType: "INVOICE",
      entityId: invoiceId,
      action: "REMINDER",
      newValues: { reminder_id: reminderId, channel: body.channel, reminder_date: body.reminder_date },
      note: body.note,
    });

    await conn.commit();
    return { reminderId };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function listReminders(companyId, invoiceId) {
  return repo.listReminders(companyId, invoiceId);
}

async function listAudit(companyId, invoiceId) {
  return repo.listAudit(companyId, invoiceId);
}

module.exports = {
  createInvoice,
  updateInvoice,
  finalizeInvoice,
  cancelInvoice,
  getInvoice,
  listInvoices,
listInvoicesFiltered,
  markSent,
  addReminder,
  listReminders,
  listAudit,

  // keep old export to avoid breaking other files
  createAndFinalizeInvoice,
};
