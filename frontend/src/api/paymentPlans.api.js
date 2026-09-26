import api, { API_BASE_URL } from "./axios";

export const paymentPlansApi = {
  list: async (params = {}) => (await api.get("/api/payment-plans", { params })).data,
  get: async (id) => (await api.get(`/api/payment-plans/${id}`)).data,
  create: async (payload) => (await api.post("/api/payment-plans", payload)).data,
  update: async (id, payload) => (await api.put(`/api/payment-plans/${id}`, payload)).data,
  cancel: async (id) => (await api.post(`/api/payment-plans/${id}/cancel`)).data,

  createInvoice: async (milestoneId, payload = {}) =>
    (await api.post(`/api/payment-plans/milestones/${milestoneId}/invoice`, payload, { timeout: 30000 })).data,
  sendDemandEmail: async (milestoneId, payload = {}) =>
    (await api.post(`/api/payment-plans/milestones/${milestoneId}/demand-email`, payload, { timeout: 60000 })).data,
  demandWhatsapp: async (milestoneId) =>
    (await api.post(`/api/payment-plans/milestones/${milestoneId}/demand-whatsapp`)).data,
  demandPdfUrl: (milestoneId) => `${API_BASE_URL}/api/payment-plans/milestones/${milestoneId}/demand.pdf`,
};
