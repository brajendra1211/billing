const asyncHandler = require("../../utils/asyncHandler");
const service = require("./vendors.service");
const v = require("./vendors.validation");
const pool = require("../../config/db");
const { assertOwned } = require("../../utils/ownership");

/* Vendors */
const listVendors = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const data = await service.listVendors(companyId);
  res.json({ ok: true, data });
});

const createVendor = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const body = v.vendorCreateSchema.parse(req.body);
  const id = await service.createVendor(companyId, body);
  res.json({ ok: true, id });
});

const updateVendor = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const id = Number(req.params.id);
  const body = v.vendorUpdateSchema.parse(req.body);
  const affected = await service.updateVendor(companyId, id, body);
  res.json({ ok: true, affected });
});

/* Services */
const listServices = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const vendorId = Number(req.params.vendorId);
  const data = await service.listServices(companyId, vendorId);
  res.json({ ok: true, data });
});

const createService = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const body = v.serviceCreateSchema.parse(req.body);
  await assertOwned(pool, "vendors", companyId, body.vendor_id, "Vendor");
  const id = await service.createService(companyId, body);
  res.json({ ok: true, id });
});

const updateService = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const id = Number(req.params.id);
  const body = v.serviceUpdateSchema.parse(req.body);
  if (body.vendor_id) await assertOwned(pool, "vendors", companyId, body.vendor_id, "Vendor");
  const affected = await service.updateService(companyId, id, body);
  res.json({ ok: true, affected });
});

/* Consumption */
const listConsumption = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const data = await service.listConsumption(companyId, req.query);
  res.json({ ok: true, data });
});

const createConsumption = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const userId = req.user.id;
  const body = v.consumptionCreateSchema.parse(req.body);
  await assertOwned(pool, "vendor_services", companyId, body.service_id, "Service", { vendor_id: body.vendor_id });
  const id = await service.createConsumption(companyId, userId, body);
  res.json({ ok: true, id });
});

const updateConsumption = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const id = Number(req.params.id);
  const body = v.consumptionUpdateSchema.parse(req.body);
  if (body.vendor_id) await assertOwned(pool, "vendors", companyId, body.vendor_id, "Vendor");
  if (body.service_id) {
    const extra = body.vendor_id ? { vendor_id: body.vendor_id } : {};
    await assertOwned(pool, "vendor_services", companyId, body.service_id, "Service", extra);
  }
  const affected = await service.updateConsumption(companyId, id, body);
  res.json({ ok: true, affected });
});

/* Bills */
const listBills = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const data = await service.listBills(companyId, req.query);
  res.json({ ok: true, data });
});

const getBill = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const billId = Number(req.params.id);
  const data = await service.getBill(companyId, billId);
  if (!data) return res.status(404).json({ ok: false, error: "Bill not found" });
  res.json({ ok: true, data });
});

const generateBill = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const userId = req.user.id;
  const body = v.billGenerateSchema.parse(req.body);
  await assertOwned(pool, "vendors", companyId, body.vendor_id, "Vendor");
  const out = await service.generateBill({
    companyId,
    userId,
    vendorId: body.vendor_id,
    billMonth: body.bill_month,
    fromDate: body.from_date,
    toDate: body.to_date,
  });
  res.json({ ok: true, ...out });
});

const addBillPayment = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const userId = req.user.id;
  const billId = Number(req.params.id);
  const body = v.billPaymentSchema.parse(req.body);
  const out = await service.addBillPayment({ companyId, userId, billId, body });
  res.json({ ok: true, data: out });
});


// ✅ Day template merged
const consumptionDay = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const vendorId = Number(req.params.vendorId);
  const date = String(req.query.date || "").trim();

  if (!vendorId) return res.status(400).json({ ok: false, error: "vendorId required" });
  if (!date) return res.status(400).json({ ok: false, error: "date required" });

  const data = await service.getConsumptionDay({ companyId, vendorId, date });
  res.json({ ok: true, data });
});

// ✅ Bulk save
const consumptionBulk = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const userId = req.user.id;

  const vendorId = Number(req.body.vendor_id);
  const consume_date = String(req.body.consume_date || "").trim();
  const lines = Array.isArray(req.body.lines) ? req.body.lines : [];

  if (!vendorId) return res.status(400).json({ ok: false, error: "vendor_id required" });
  if (!consume_date) return res.status(400).json({ ok: false, error: "consume_date required" });
  if (lines.length === 0) return res.status(400).json({ ok: false, error: "lines required" });
  await assertOwned(pool, "vendors", companyId, vendorId, "Vendor");

  const out = await service.saveConsumptionBulk({
    companyId,
    userId,
    vendorId,
    consume_date,
    lines,
  });

  res.json({ ok: true, data: out });
});

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

  listBills,
  getBill,
  generateBill,
  addBillPayment,
  consumptionDay,
  consumptionBulk,

};
