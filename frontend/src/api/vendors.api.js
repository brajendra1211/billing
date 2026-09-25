import api from "./axios";

export const vendorsApi = {
  // Vendors
  list: async () => (await api.get("/api/vendors")).data,
  create: async (payload) => (await api.post("/api/vendors", payload)).data,
  update: async (id, payload) => (await api.put(`/api/vendors/${id}`, payload)).data,

  // Vendor Services
  servicesList: async (vendorId) =>
    (await api.get(`/api/vendors/${vendorId}/services`)).data,

  serviceCreate: async (payload) =>
    (await api.post(`/api/vendors/services`, payload)).data,

  serviceUpdate: async (id, payload) =>
    (await api.put(`/api/vendors/services/${id}`, payload)).data,

  // ✅ Soft delete / Activate
  serviceDeactivate: async (id) =>
    (await api.put(`/api/vendors/services/${id}`, { is_active: 0 })).data,

  serviceActivate: async (id) =>
    (await api.put(`/api/vendors/services/${id}`, { is_active: 1 })).data,

  // Consumption
  consumptionList: async (params = {}) =>
    (await api.get(`/api/vendors/consumption/list`, { params })).data,

  consumptionCreate: async (payload) =>
    (await api.post(`/api/vendors/consumption`, payload)).data,

  // ✅ Day template merged
  consumptionDay: async (vendorId, date) =>
    (await api.get(`/api/vendors/${vendorId}/consumption/day`, { params: { date } })).data,

  // ✅ Bulk save
  consumptionBulk: async (payload) =>
    (await api.post(`/api/vendors/consumption/bulk`, payload)).data,

  // Bills
  billsList: async (params = {}) =>
    (await api.get(`/api/vendors/bills`, { params })).data,

  billGet: async (id) =>
    (await api.get(`/api/vendors/bills/${id}`)).data,

  billGenerate: async (payload) =>
    (await api.post(`/api/vendors/bills/generate`, payload)).data,

  billPay: async (id, payload) =>
    (await api.post(`/api/vendors/bills/${id}/pay`, payload)).data,
};
