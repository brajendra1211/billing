import api from "./axios";

export const invoicesApi = {
  list: async (params = {}) => (await api.get("/api/invoices", { params })).data,
  get: async (id) => (await api.get(`/api/invoices/${id}`)).data,
  create: async (payload) => (await api.post("/api/invoices", payload)).data,

  // ✅ add this
  update: async (id, payload) => (await api.put(`/api/invoices/${id}`, payload)).data,

  finalize: async (id) => (await api.post(`/api/invoices/${id}/finalize`, {})).data,
  markSent: async (id, payload = {}) => (await api.post(`/api/invoices/${id}/mark-sent`, payload)).data,
  reminders: async (id) => (await api.get(`/api/invoices/${id}/reminders`)).data,
  addReminder: async (id, payload) => (await api.post(`/api/invoices/${id}/reminders`, payload)).data,
  audit: async (id) => (await api.get(`/api/invoices/${id}/audit`)).data,
  sendEmail: async (id, payload) => (await api.post(`/api/invoices/${id}/send-email`, payload, { timeout: 60000 })).data,
  whatsappLink: async (id) => (await api.get(`/api/invoices/${id}/whatsapp-link`)).data,
  // cancel: async (id, payload) => (await api.post(`/api/invoices/${id}/cancel`, payload)).data,
};
