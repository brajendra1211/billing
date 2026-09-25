import api from "./axios";

export const companyApi = {
  getMe: async () => (await api.get("/api/company/me")).data,
  updateMe: async (payload) => (await api.put("/api/company/me", payload)).data,

  uploadLogo: async (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return (await api.post("/api/company/me/logo", fd)).data;
  },

  uploadSignature: async (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return (await api.post("/api/company/me/signature", fd)).data;
  },
};
