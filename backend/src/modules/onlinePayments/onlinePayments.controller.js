const asyncHandler = require("../../utils/asyncHandler");
const service = require("./onlinePayments.service");

const list = asyncHandler(async (req, res) => {
  const data = await service.listForInvoice(req.user.companyId, Number(req.params.id));
  res.json({ ok: true, data });
});

const create = asyncHandler(async (req, res) => {
  const data = await service.getOrCreateLink({
    companyId: req.user.companyId,
    invoiceId: Number(req.params.id),
    userId: req.user.id,
  });
  res.json({ ok: true, data });
});

const sync = asyncHandler(async (req, res) => {
  const results = await service.syncInvoice(req.user.companyId, Number(req.params.id));
  res.json({ ok: true, data: { results } });
});

/** Razorpay webhook: needs the raw body for signature verification */
const webhook = asyncHandler(async (req, res) => {
  const data = await service.handleWebhook(req.body, req.headers["x-razorpay-signature"]);
  res.json({ ok: true, data });
});

module.exports = { list, create, sync, webhook };
