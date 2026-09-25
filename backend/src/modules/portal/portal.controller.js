const asyncHandler = require("../../utils/asyncHandler");
const service = require("./portal.service");

/* Public (token in URL) */
const overview = asyncHandler(async (req, res) => {
  const data = await service.overview(req.params.token);
  res.json({ ok: true, data });
});

const invoicePdf = asyncHandler(async (req, res) => {
  const out = await service.invoicePdf(req.params.token, Number(req.params.id));
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${String(out.invoiceNo).replace(/[^\w.-]+/g, "_")}.pdf"`);
  res.send(out.pdf);
});

const pay = asyncHandler(async (req, res) => {
  const data = await service.pay(req.params.token, Number(req.params.id));
  res.json({ ok: true, data });
});

const sync = asyncHandler(async (req, res) => {
  const data = await service.sync(req.params.token, Number(req.params.id));
  res.json({ ok: true, data });
});

/* Staff (authenticated) */
const staffLink = asyncHandler(async (req, res) => {
  const data = await service.staffLink(req.user.companyId, Number(req.params.id));
  res.json({ ok: true, data });
});

const staffRegenerate = asyncHandler(async (req, res) => {
  const data = await service.staffRegenerate(req.user.companyId, Number(req.params.id));
  res.json({ ok: true, data });
});

module.exports = { overview, invoicePdf, pay, sync, staffLink, staffRegenerate };
