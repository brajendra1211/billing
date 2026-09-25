const asyncHandler = require("../../utils/asyncHandler");
const service = require("./creditNotes.service");
const { creditNoteCreateSchema } = require("./creditNotes.validation");

const listForInvoice = asyncHandler(async (req, res) => {
  const data = await service.listForInvoice(req.user.companyId, Number(req.params.id));
  res.json({ ok: true, data });
});

const create = asyncHandler(async (req, res) => {
  const body = creditNoteCreateSchema.parse(req.body || {});
  const data = await service.createCreditNote({
    companyId: req.user.companyId,
    userId: req.user.id,
    invoiceId: Number(req.params.id),
    body,
  });
  res.json({ ok: true, data });
});

const listAll = asyncHandler(async (req, res) => {
  const data = await service.listAll(req.user.companyId, { from: req.query.from, to: req.query.to });
  res.json({ ok: true, data });
});

const pdf = asyncHandler(async (req, res) => {
  const out = await service.generateCreditNotePdf(req.user.companyId, Number(req.params.id));
  if (!out) return res.status(404).json({ ok: false, error: "Credit note not found" });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${String(out.cnNo).replace(/[^\w.-]+/g, "_")}.pdf"`);
  res.send(out.pdf);
});

module.exports = { listForInvoice, create, listAll, pdf };
