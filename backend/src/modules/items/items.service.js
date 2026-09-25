const repo = require("./items.repository");

async function listItems(companyId) {
  return repo.findAll(companyId);
}

async function createItem(companyId, payload) {
  return repo.create(companyId, payload);
}

async function updateItem(companyId, id, payload) {
  return repo.update(companyId, id, payload);
}

async function deleteItem(companyId, id) {
  return repo.remove(companyId, id);
}

module.exports = { listItems, createItem, updateItem, deleteItem };
