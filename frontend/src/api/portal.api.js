import axios from "axios";
import { API_BASE_URL } from "./axios";

// Separate client: the portal is public, so no staff token and no redirect-to-login on errors
const portal = axios.create({ baseURL: API_BASE_URL, timeout: 30000 });

export const portalApi = {
  overview: async (token) => (await portal.get(`/api/portal/${token}`)).data,
  pay: async (token, invoiceId) => (await portal.post(`/api/portal/${token}/invoices/${invoiceId}/pay`)).data,
  sync: async (token, invoiceId) => (await portal.post(`/api/portal/${token}/invoices/${invoiceId}/sync`)).data,
  pdfUrl: (token, invoiceId) => `${API_BASE_URL}/api/portal/${token}/invoices/${invoiceId}/pdf`,
};
