const asyncHandler = require("../../utils/asyncHandler");
const {
  invoiceCreateSchema,
  invoiceUpdateSchema,
  finalizeSchema,
  cancelSchema,
  markSentSchema,
  reminderCreateSchema,
} = require("./invoices.validation");
const service = require("./invoices.service");

// ✅ CREATE = DRAFT invoice (not auto finalize)
const create = asyncHandler(async (req, res) => {
  const payload = invoiceCreateSchema.parse(req.body);
  const companyId = req.user.companyId;
  const userId = req.user.id;

  const out = await service.createInvoice({ companyId, userId, payload });
  res.json({ ok: true, ...out });
});

const getOne = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const invoiceId = Number(req.params.id);

  const data = await service.getInvoice(companyId, invoiceId);
  if (!data) return res.status(404).json({ ok: false, error: "Invoice not found" });

  res.json({ ok: true, data });
});

const list = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;

  const data = await service.listInvoicesFiltered(companyId, {
    search: req.query.search,
    status: req.query.status,
    from: req.query.from,
    to: req.query.to,
    due_only: req.query.due_only,
    page: req.query.page,
    limit: req.query.limit,
  });

  res.json({ ok: true, data });
});



// ✅ FINALIZE = DRAFT -> FINAL
const finalize = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const userId = req.user.id;
  const invoiceId = Number(req.params.id);

  finalizeSchema.parse(req.body || {});
  const out = await service.finalizeInvoice({ companyId, userId, invoiceId });

  res.json({ ok: true, data: out });
});

// ✅ CANCEL = ADMIN only (route side)
const cancel = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const userId = req.user.id;
  const invoiceId = Number(req.params.id);

  const body = cancelSchema.parse(req.body);
  const out = await service.cancelInvoice({
    companyId,
    userId,
    invoiceId,
    reason: body.reason,
  });

  res.json({ ok: true, data: out });
});

const update = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const userId = req.user.id;
  const invoiceId = Number(req.params.id);

  const patch = invoiceUpdateSchema.parse(req.body);
  const out = await service.updateInvoice({ companyId, userId, invoiceId, patch });

  res.json({ ok: true, ...out });
});

const markSent = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const userId = req.user.id;
  const invoiceId = Number(req.params.id);
  const body = markSentSchema.parse(req.body || {});

  const out = await service.markSent({ companyId, userId, invoiceId, body });
  res.json({ ok: true, data: out });
});

const addReminder = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const userId = req.user.id;
  const invoiceId = Number(req.params.id);
  const body = reminderCreateSchema.parse(req.body || {});

  const out = await service.addReminder({ companyId, userId, invoiceId, body });
  res.json({ ok: true, data: out });
});

const listReminders = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const invoiceId = Number(req.params.id);

  const data = await service.listReminders(companyId, invoiceId);
  res.json({ ok: true, data });
});

const listAudit = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const invoiceId = Number(req.params.id);

  const data = await service.listAudit(companyId, invoiceId);
  res.json({ ok: true, data });
});

module.exports = { create, getOne, list, update, finalize, cancel, markSent, addReminder, listReminders, listAudit };

