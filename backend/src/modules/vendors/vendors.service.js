const pool = require("../../config/db");
const repo = require("./vendors.repository");

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

async function listVendors(companyId) {
  return repo.listVendors(companyId);
}
async function createVendor(companyId, body) {
  return repo.createVendor(companyId, body);
}
async function updateVendor(companyId, id, body) {
  return repo.updateVendor(companyId, id, body);
}

async function listServices(companyId, vendorId) {
  return repo.listServices(companyId, vendorId);
}
async function createService(companyId, body) {
  return repo.createService(companyId, body);
}
async function updateService(companyId, id, body) {
  return repo.updateService(companyId, id, body);
}

async function listConsumption(companyId, q) {
  return repo.listConsumption(companyId, q);
}
async function createConsumption(companyId, userId, body) {
  return repo.createConsumption(companyId, userId, body);
}
async function updateConsumption(companyId, id, body) {
  return repo.updateConsumption(companyId, id, body);
}

/**
 * ✅ Day template merged: servicesList + existing consumption of that day
 * Returns: [{ service_id, service_name, unit, rate, qty, amount }]
 */
async function getConsumptionDay({ companyId, vendorId, date }) {
  const services = await repo.listServices(companyId, vendorId);

  // your existing listConsumption supports filters
  const existing = await repo.listConsumption(companyId, {
    vendor_id: vendorId,
    from: date,
    to: date,
  });

  // existing rows expected to have: service_id, service_name, unit, rate, qty, amount
  const map = new Map();
  (existing || []).forEach((e) => {
    map.set(Number(e.service_id), {
      service_id: Number(e.service_id),
      service_name: e.service_name,
      unit: e.unit,
      rate: Number(e.rate || 0),
      qty: Number(e.qty || 0),
      amount: Number(e.amount || 0),
    });
  });

  const merged = (services || []).map((s) => {
    const key = Number(s.id);
    const found = map.get(key);

    const qty = found ? Number(found.qty || 0) : 0;
    const rate = Number(found?.rate || s.rate || 0);

    return {
      service_id: key,
      service_name: s.name,
      unit: s.unit,
      rate,
      qty,
      amount: round2(qty * rate),
    };
  });

  return merged;
}

/**
 * ✅ Bulk save (upsert by day)
 * Payload: { vendor_id, consume_date, lines:[{service_id, qty, notes}] }
 */
async function saveConsumptionBulk({ companyId, userId, vendorId, consume_date, lines }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // rate map from services (single query)
    const services = await repo.listServices(companyId, vendorId);
    const rateMap = new Map((services || []).map((s) => [Number(s.id), Number(s.rate || 0)]));

    for (const ln of lines || []) {
      const service_id = Number(ln.service_id);
      const qty = Number(ln.qty || 0);

      if (!service_id || !(qty > 0)) continue;

      if (!rateMap.has(service_id)) continue; // not this vendor's service
      const rate = Number(rateMap.get(service_id) || 0);
      const amount = round2(qty * rate);

      // ✅ needs repo.upsertConsumption(conn, row)
      await repo.upsertConsumption(conn, {
        company_id: companyId,
        vendor_id: Number(vendorId),
        service_id,
        consume_date,
        qty,
        rate,
        amount,
        notes: ln.notes || null,
        created_by: userId,
      });
    }

    await conn.commit();
    return { vendorId: Number(vendorId), consume_date };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function listBills(companyId, q) {
  return repo.listBills(companyId, q);
}
async function getBill(companyId, billId) {
  return repo.getBill(companyId, billId);
}
async function generateBill({ companyId, userId, vendorId, billMonth, fromDate, toDate }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const out = await repo.generateBill(conn, {
      companyId,
      userId,
      vendorId,
      billMonth,
      fromDate,
      toDate,
    });
    await conn.commit();
    return out;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function addBillPayment({ companyId, userId, billId, body }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const out = await repo.addBillPayment(conn, { companyId, userId, billId, body });
    await conn.commit();
    return out;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

module.exports = {
  listVendors,
  createVendor,
  updateVendor,

  listServices,
  createService,
  updateService,

  listConsumption,
  createConsumption,
  updateConsumption,

  // ✅ NEW exports
  getConsumptionDay,
  saveConsumptionBulk,

  listBills,
  getBill,
  generateBill,
  addBillPayment,
};
