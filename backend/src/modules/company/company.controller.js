const asyncHandler = require("../../utils/asyncHandler");
const service = require("./company.service");
const { companyUpdateSchema } = require("./company.validation");

const getMe = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const data = await service.getCompany(companyId);
  if (!data) return res.status(404).json({ ok: false, error: "Company not found" });
  res.json({ ok: true, data });
});

const updateMe = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const patch = companyUpdateSchema.parse(req.body);

  const affectedRows = await service.updateCompany(companyId, patch);
  res.json({ ok: true, affectedRows });
});

const uploadLogo = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  if (!req.file) return res.status(400).json({ ok: false, error: "File required" });

  const url = `/uploads/logos/${req.file.filename}`;
  await service.updateLogo(companyId, url);
  res.json({ ok: true, logo_url: url });
});

const uploadSignature = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  if (!req.file) return res.status(400).json({ ok: false, error: "File required" });

  const url = `/uploads/signatures/${req.file.filename}`;
  await service.updateSignature(companyId, url);
  res.json({ ok: true, signature_url: url });
});
module.exports = { getMe, updateMe, uploadLogo, uploadSignature };
