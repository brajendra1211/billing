const asyncHandler = require("../../utils/asyncHandler");
const service = require("./expenses.service");
const {
  expenseCreateSchema,
  expenseUpdateSchema,
  categoryCreateSchema,
  categoryUpdateSchema,
} = require("./expenses.validation");

/* Categories */
const listCategories = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const data = await service.listCategories(companyId);
  res.json({ ok: true, data });
});

const createCategory = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const userId = req.user.id;
  const body = categoryCreateSchema.parse(req.body);
  const id = await service.createCategory(companyId, userId, body);
  res.json({ ok: true, id });
});

const updateCategory = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const id = Number(req.params.id);
  const body = categoryUpdateSchema.parse(req.body);
  const affected = await service.updateCategory(companyId, id, body);
  res.json({ ok: true, affected });
});

/* Expenses */
const listExpenses = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const data = await service.listExpenses(companyId, req.query);
  res.json({ ok: true, data });
});

const createExpense = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const userId = req.user.id;
  const body = expenseCreateSchema.parse(req.body);
  const id = await service.createExpense(companyId, userId, body);
  res.json({ ok: true, id });
});

const updateExpense = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const id = Number(req.params.id);
  const body = expenseUpdateSchema.parse(req.body);
  const affected = await service.updateExpense(companyId, id, body);
  res.json({ ok: true, affected });
});

const deleteExpense = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const id = Number(req.params.id);
  const affected = await service.deleteExpense(companyId, id);
  res.json({ ok: true, affected });
});

module.exports = {
  listCategories,
  createCategory,
  updateCategory,
  listExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
};
