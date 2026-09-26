const asyncHandler = require("../../utils/asyncHandler");
const service = require("./paymentPlans.service");
const v = require("./paymentPlans.validation");

const list = asyncHandler(async (req, res) => {
  const data = await service.listPlans(req.user.companyId, { customer_id: req.query.customer_id });
  res.json({ ok: true, data });
});

const getOne = asyncHandler(async (req, res) => {
  const data = await service.getPlan(req.user.companyId, Number(req.params.id));
  res.json({ ok: true, data });
});

const create = asyncHandler(async (req, res) => {
  const body = v.planSchema.parse(req.body || {});
  const data = await service.createPlan(req.user.companyId, req.user.id, body);
  res.json({ ok: true, data });
});

const update = asyncHandler(async (req, res) => {
  const body = v.planSchema.parse(req.body || {});
  const data = await service.updatePlan(req.user.companyId, req.user.id, Number(req.params.id), body);
  res.json({ ok: true, data });
});

const cancel = asyncHandler(async (req, res) => {
  const data = await service.cancelPlan(req.user.companyId, req.user.id, Number(req.params.id));
  res.json({ ok: true, data });
});

const createInvoice = asyncHandler(async (req, res) => {
  const body = v.milestoneInvoiceSchema.parse(req.body || {});
  const data = await service.createMilestoneInvoice(req.user.companyId, req.user.id, Number(req.params.mid), body);
  res.json({ ok: true, data });
});

const demandPdf = asyncHandler(async (req, res) => {
  const out = await service.generateDemandPdf(req.user.companyId, Number(req.params.mid));
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${out.demandNo.replace(/[^\w.-]+/g, "_")}.pdf"`);
  res.send(out.pdf);
});

const demandEmail = asyncHandler(async (req, res) => {
  const body = v.demandEmailSchema.parse(req.body || {});
  const data = await service.sendDemandEmail(req.user.companyId, req.user.id, Number(req.params.mid), body);
  res.json({ ok: true, data });
});

const demandWhatsapp = asyncHandler(async (req, res) => {
  const data = await service.demandWhatsapp(req.user.companyId, req.user.id, Number(req.params.mid));
  res.json({ ok: true, data });
});

module.exports = { list, getOne, create, update, cancel, createInvoice, demandPdf, demandEmail, demandWhatsapp };
