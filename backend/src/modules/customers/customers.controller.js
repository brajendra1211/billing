const asyncHandler = require("../../utils/asyncHandler");
const service = require("./customers.service");
const { customerCreateSchema } = require("./customers.validation");

const getAll = asyncHandler(async (req, res) => {
  const data = await service.listCustomers(req.user.companyId);
  res.json({ ok: true, data });
});

const create = asyncHandler(async (req, res) => {
  const payload = customerCreateSchema.parse(req.body);
  const id = await service.createCustomer(req.user.companyId, payload);
  res.json({ ok: true, id });
});

const update = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const payload = customerCreateSchema.parse(req.body); // same shape for now
  const affectedRows = await service.updateCustomer(req.user.companyId, id, payload);
  res.json({ ok: true, affectedRows });
});

const remove = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const affectedRows = await service.deleteCustomer(req.user.companyId, id);
  res.json({ ok: true, affectedRows });
});

module.exports = { getAll, create, update, remove };
