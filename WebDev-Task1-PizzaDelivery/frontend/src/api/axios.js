import axios from "axios";

// In development the Vite proxy forwards /api → http://localhost:5000
// In production set VITE_API_URL=https://your-api-domain.com/api in frontend/.env
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // Auto-redirect on 401 only for non-auth endpoints and only when not already on /login
    if (
      err.response?.status === 401 &&
      !err.config?.url?.includes("/auth/") &&
      window.location.pathname !== "/login"
    ) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default api;
