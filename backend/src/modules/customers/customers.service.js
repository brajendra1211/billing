const repo = require("./customers.repository");

async function listCustomers(companyId) {
  return repo.findAll(companyId);
}

async function createCustomer(companyId, payload) {
  return repo.create(companyId, payload);
}

async function updateCustomer(companyId, id, payload) {
  return repo.update(companyId, id, payload);
}

async function deleteCustomer(companyId, id) {
  return repo.remove(companyId, id);
}

module.exports = { listCustomers, createCustomer, updateCustomer, deleteCustomer };
