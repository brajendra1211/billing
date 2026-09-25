const asyncHandler = require("../../utils/asyncHandler");
const service = require("./items.service");
const { itemCreateSchema } = require("./items.validation");

const getAll = asyncHandler(async (req, res) => {
  const data = await service.listItems(req.user.companyId);
  res.json({ ok: true, data });
});

const create = asyncHandler(async (req, res) => {
  const payload = itemCreateSchema.parse(req.body);
  const id = await service.createItem(req.user.companyId, payload);
  res.json({ ok: true, id });
});

const update = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const payload = itemCreateSchema.parse(req.body);
  const affectedRows = await service.updateItem(req.user.companyId, id, payload);
  res.json({ ok: true, affectedRows });
});

const remove = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const affectedRows = await service.deleteItem(req.user.companyId, id);
  res.json({ ok: true, affectedRows });
});

module.exports = { getAll, create, update, remove };
