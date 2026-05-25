import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  headers: { "Content-Type": "application/json" },
});

// Attach JWT to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = localStorage.getItem("refresh_token");
      if (refresh) {
        try {
          const { data } = await axios.post(`${BASE_URL}/api/auth/refresh/`, { refresh });
          localStorage.setItem("access_token", data.access);
          original.headers.Authorization = `Bearer ${data.access}`;
          return api(original);
        } catch {
          localStorage.clear();
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// Auth
export const login = (email, password) =>
  api.post("/auth/login/", { email, password });

export const getMe = () => api.get("/auth/me/");

// Dashboard
export const getDashboardStats = () => api.get("/dashboard/stats/");

// Data sources
export const getDataSources = () => api.get("/data-sources/");
export const createDataSource = (data) => api.post("/data-sources/", data);

// Batches
export const getBatches = (params) => api.get("/batches/", { params });
export const getBatch = (id) => api.get(`/batches/${id}/`);

// Upload
export const uploadSAP = (formData) =>
  api.post("/upload/sap/", formData, { headers: { "Content-Type": "multipart/form-data" } });

export const uploadUtility = (formData) =>
  api.post("/upload/utility/", formData, { headers: { "Content-Type": "multipart/form-data" } });

export const uploadTravel = (formData) =>
  api.post("/upload/travel/", formData, { headers: { "Content-Type": "multipart/form-data" } });

// Records
export const getRecords = (params) => api.get("/records/", { params });
export const getRecord = (id) => api.get(`/records/${id}/`);

// Reviews
export const reviewRecord = (id, action, comment) =>
  api.post(`/records/${id}/review/`, { action, comment });

export const bulkReview = (record_ids, action, comment) =>
  api.post("/records/bulk-review/", { record_ids, action, comment });

// Audit
export const getRecordAudit = (id) => api.get(`/records/${id}/audit/`);
export const getAuditLog = () => api.get("/audit/");
