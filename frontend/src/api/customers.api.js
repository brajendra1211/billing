import api from "./axios";

export const customersApi = {
  list: async () => (await api.get("/api/customers")).data,
  create: async (payload) => (await api.post("/api/customers", payload)).data,
  update: async (id, payload) => (await api.put(`/api/customers/${id}`, payload)).data,
  remove: async (id) => (await api.delete(`/api/customers/${id}`)).data,
};
