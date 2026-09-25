import api from "./axios";

export const expensesApi = {
  list: async (params = {}) => (await api.get("/api/expenses", { params })).data,
  create: async (payload) => (await api.post("/api/expenses", payload)).data,
  update: async (id, payload) => (await api.put(`/api/expenses/${id}`, payload)).data,
  remove: async (id) => (await api.delete(`/api/expenses/${id}`)).data,

  categoriesList: async () => (await api.get("/api/expenses/categories")).data,
  categoryCreate: async (payload) => (await api.post("/api/expenses/categories", payload)).data,
  categoryUpdate: async (id, payload) => (await api.put(`/api/expenses/categories/${id}`, payload)).data,
};
