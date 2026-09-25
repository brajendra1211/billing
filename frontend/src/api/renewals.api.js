import api from "./axios";

export const renewalsApi = {
  list: async (params={}) => (await api.get("/api/renewals", { params })).data,
  create: async (payload) => (await api.post("/api/renewals", payload)).data,
  get: async (id) => (await api.get(`/api/renewals/${id}`)).data,
  update: async (id, payload) => (await api.put(`/api/renewals/${id}`, payload)).data,

  alerts: async () => (await api.get("/api/renewals/alerts")).data,

  payments: async (id) => (await api.get(`/api/renewals/${id}/payments`)).data,
  addPayment: async (id, payload) => (await api.post(`/api/renewals/${id}/payments`, payload)).data,
  createInvoice: async (id, payload = {}) => (await api.post(`/api/renewals/${id}/create-invoice`, payload)).data,
};
