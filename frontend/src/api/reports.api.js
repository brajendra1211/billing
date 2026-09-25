import api from "./axios";


export const reportsApi = {
  dashboard: async (params = {}) => (await api.get("/api/reports/dashboard", { params })).data,
  customer: async (customerId, params = {}) => (await api.get(`/api/reports/customers/${customerId}`, { params })).data,
  ledger: async (customerId, params = {}) => (await api.get(`/api/reports/customers/${customerId}/ledger`, { params })).data,
  customers: async (params = {}) => (await api.get("/api/reports/customers", { params })).data,
};
