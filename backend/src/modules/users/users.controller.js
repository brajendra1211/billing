const asyncHandler = require("../../utils/asyncHandler");
const service = require("./users.service");
const {
  createUserSchema,
  updateUserSchema,
  setActiveSchema,
  resetPasswordSchema,
} = require("./users.validation");

const list = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const data = await service.list(companyId);
  res.json({ ok: true, data });
});

const create = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const payload = createUserSchema.parse(req.body);
  const out = await service.create(companyId, payload);
  res.json({ ok: true, ...out });
});

const update = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const id = Number(req.params.id);
  const payload = updateUserSchema.parse(req.body);
  const out = await service.update(companyId, id, payload);
  res.json({ ok: true, ...out });
});

const setActive = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const id = Number(req.params.id);
  const payload = setActiveSchema.parse(req.body);
  const out = await service.setActive(companyId, id, payload.is_active);
  res.json({ ok: true, ...out });
});

const resetPassword = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const id = Number(req.params.id);
  const payload = resetPasswordSchema.parse(req.body);
  const out = await service.resetPassword(companyId, id, payload.password);
  res.json({ ok: true, ...out });
});

module.exports = { list, create, update, setActive, resetPassword };
