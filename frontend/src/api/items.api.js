import api from "./axios";

export const itemsApi = {
  list: async () => (await api.get("/api/items")).data,
  create: async (payload) => (await api.post("/api/items", payload)).data,
  update: async (id, payload) => (await api.put(`/api/items/${id}`, payload)).data,
  remove: async (id) => (await api.delete(`/api/items/${id}`)).data,
};
