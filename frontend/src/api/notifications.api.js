import api from "./axios";

export const notificationsApi = {
  getSettings: async () => (await api.get("/api/notifications/settings")).data,
  saveSettings: async (payload) => (await api.put("/api/notifications/settings", payload)).data,
  runNow: async () => (await api.post("/api/notifications/run", {}, { timeout: 180000 })).data,
  testEmail: async (to) => (await api.post("/api/notifications/test-email", { to: to || null }, { timeout: 60000 })).data,
  log: async (params = {}) => (await api.get("/api/notifications/log", { params })).data,
};
