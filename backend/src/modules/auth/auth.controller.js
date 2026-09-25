const asyncHandler = require("../../utils/asyncHandler");
const { loginSchema } = require("./auth.validation");
const service = require("./auth.service");

const login = asyncHandler(async (req, res) => {
  const payload = loginSchema.parse(req.body);
  const data = await service.login(payload);
  res.json({ ok: true, ...data });
});

module.exports = { login };
