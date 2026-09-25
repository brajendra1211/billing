const asyncHandler = require("../../utils/asyncHandler");
const service = require("./notifications.service");
const v = require("./notifications.validation");

const sendInvoiceEmail = asyncHandler(async (req, res) => {
  const body = v.sendInvoiceEmailSchema.parse(req.body || {});
  const data = await service.sendInvoiceEmail({
    companyId: req.user.companyId,
    userId: req.user.id,
    invoiceId: Number(req.params.id),
    to: body.to,
    cc: body.cc,
    message: body.message,
  });
  res.json({ ok: true, data });
});

const whatsappLink = asyncHandler(async (req, res) => {
  const data = await service.whatsappLink({
    companyId: req.user.companyId,
    invoiceId: Number(req.params.id),
    phone: req.query.phone,
  });
  res.json({ ok: true, data });
});

const getSettings = asyncHandler(async (req, res) => {
  const [settings, status] = await Promise.all([
    service.getSettings(req.user.companyId),
    service.status(req.user.companyId),
  ]);
  res.json({ ok: true, data: { settings, status } });
});

const saveSettings = asyncHandler(async (req, res) => {
  const body = v.settingsSchema.parse(req.body || {});
  const settings = await service.saveSettings(req.user.companyId, body);
  res.json({ ok: true, data: settings });
});

const runNow = asyncHandler(async (req, res) => {
  const data = await service.runForCompany(req.user.companyId);
  res.json({ ok: true, data });
});

const testEmail = asyncHandler(async (req, res) => {
  const body = v.testEmailSchema.parse(req.body || {});
  const data = await service.sendTestEmail(req.user.companyId, body.to);
  res.json({ ok: true, data });
});

const log = asyncHandler(async (req, res) => {
  const limit = Math.min(500, Math.max(1, Number(req.query.limit || 100)));
  const data = await service.listLog(req.user.companyId, limit);
  res.json({ ok: true, data });
});

module.exports = { sendInvoiceEmail, whatsappLink, getSettings, saveSettings, runNow, testEmail, log };
