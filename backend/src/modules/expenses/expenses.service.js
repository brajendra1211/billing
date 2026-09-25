const repo = require("./expenses.repository");

async function listCategories(companyId) {
  return repo.listCategories(companyId);
}

async function createCategory(companyId, userId, body) {
  return repo.createCategory(companyId, userId, body);
}

async function updateCategory(companyId, id, body) {
  return repo.updateCategory(companyId, id, body);
}

async function listExpenses(companyId, query) {
  return repo.listExpenses(companyId, query);
}

async function createExpense(companyId, userId, body) {
  return repo.createExpense(companyId, userId, body);
}

async function updateExpense(companyId, id, body) {
  const ex = await repo.getExpense(companyId, id);
  if (!ex) {
    const err = new Error("Expense not found");
    err.statusCode = 404;
    throw err;
  }
  return repo.updateExpense(companyId, id, body);
}

async function deleteExpense(companyId, id) {
  const ex = await repo.getExpense(companyId, id);
  if (!ex) {
    const err = new Error("Expense not found");
    err.statusCode = 404;
    throw err;
  }
  return repo.deleteExpense(companyId, id);
}

module.exports = {
  listCategories,
  createCategory,
  updateCategory,
  listExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
};
