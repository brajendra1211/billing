const asyncHandler = require("../../utils/asyncHandler");
const v = require("./renewals.validation");
const service = require("./renewals.service");
const pool = require("../../config/db");
const { assertOwned } = require("../../utils/ownership");

const list = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const data = await service.listRenewals(companyId, req.query);
  res.json({ ok: true, data });
});

const create = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const userId = req.user.id;
  const body = v.renewalCreateSchema.parse(req.body);
  if (body.customer_id) await assertOwned(pool, "customers", companyId, body.customer_id, "Customer");
  const id = await service.createRenewal(companyId, userId, body);
  res.json({ ok: true, id });
});

const getOne = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const id = Number(req.params.id);
  const data = await service.getRenewal(companyId, id);
  if (!data) return res.status(404).json({ ok: false, error: "Not found" });
  res.json({ ok: true, data });
});

const update = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const id = Number(req.params.id);
  const body = v.renewalUpdateSchema.parse(req.body);
  if (body.customer_id) await assertOwned(pool, "customers", companyId, body.customer_id, "Customer");
  const affected = await service.updateRenewal(companyId, id, body);
  res.json({ ok: true, affected });
});

const paymentsList = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const id = Number(req.params.id);
  const data = await service.listPayments(companyId, id);
  res.json({ ok: true, data });
});

const addPayment = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const userId = req.user.id;
  const id = Number(req.params.id);
  const body = v.paymentCreateSchema.parse(req.body);
  const out = await service.addPayment({ companyId, userId, recurringId: id, body });
  res.json({ ok: true, data: out });
});

const createInvoice = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const userId = req.user.id;
  const id = Number(req.params.id);
  const body = v.invoiceFromRenewalSchema.parse(req.body || {});
  const out = await service.createInvoiceFromRenewal({ companyId, userId, recurringId: id, body });
  res.json({ ok: true, data: out });
});

const alerts = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const data = await service.dashboardAlerts(companyId);
  res.json({ ok: true, data });
});

module.exports = { list, create, getOne, update, paymentsList, addPayment, alerts, createInvoice };
