const repo = require("./reports.repository");

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function daysAgoISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function dashboard(companyId, query) {
  const from = query.from || daysAgoISO(30);
  const to = query.to || todayISO();
  const top = Number(query.top || 10);

  const summary = await repo.getSummary(companyId, from, to);
  const daily = await repo.getDailySales(companyId, from, to);
  const topDueCustomers = await repo.getTopDueCustomers(companyId, top);
  const dueAging = await repo.getDueAging(companyId);
const profit = await repo.getProfit(companyId, from, to);
return { range: { from, to }, summary, daily, topDueCustomers, dueAging, profit };
  
}

async function customer(companyId, customerId, query) {
  const limit = Number(query.limit || 20);
  return repo.getCustomerOutstanding(companyId, customerId, limit);
}

async function ledger(companyId, customerId, query) {
  const limit = Number(query.limit || 100);
  return repo.getCustomerLedger(companyId, customerId, limit);
}

async function customers(companyId, query) {
  return repo.listCustomers(companyId, query.search || "");
}


module.exports = { dashboard, customer, customers, ledger };


