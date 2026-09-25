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
  creditNotes: async (id) => (await api.get(`/api/invoices/${id}/credit-notes`)).data,
  paymentLinks: async (id) => (await api.get(`/api/invoices/${id}/payment-links`)).data,
  createPaymentLink: async (id) => (await api.post(`/api/invoices/${id}/payment-link`, {}, { timeout: 30000 })).data,
  syncPaymentLink: async (id) => (await api.post(`/api/invoices/${id}/payment-link/sync`, {}, { timeout: 30000 })).data,
  createCreditNote: async (id, payload) => (await api.post(`/api/invoices/${id}/credit-notes`, payload)).data,
  // cancel: async (id, payload) => (await api.post(`/api/invoices/${id}/cancel`, payload)).data,
};
