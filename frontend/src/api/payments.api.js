import api from "./axios";

export const paymentsApi = {
  listByInvoice: async (invoiceId) =>
    (await api.get(`/api/invoices/${invoiceId}/payments`)).data,

  addToInvoice: async (invoiceId, payload) =>
    (await api.post(`/api/invoices/${invoiceId}/payments`, payload)).data,

  remove: async (invoiceId, paymentId, reason) =>
    (await api.delete(`/api/invoices/${invoiceId}/payments/${paymentId}`, { data: { reason } })).data,
};
