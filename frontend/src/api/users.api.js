import api from "./axios";

export const usersApi = {
  list: () => api.get("/api/users").then((r) => r.data),
  create: (payload) => api.post("/api/users", payload).then((r) => r.data),
  update: (id, payload) => api.put(`/api/users/${id}`, payload).then((r) => r.data),
  setActive: (id, is_active) =>
    api.patch(`/api/users/${id}/active`, { is_active }).then((r) => r.data),
  resetPassword: (id, password) =>
    api.post(`/api/users/${id}/reset-password`, { password }).then((r) => r.data),
};
