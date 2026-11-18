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

// Endpoints where a 401 should NOT trigger an automatic session-clear redirect.
// The calling code (e.g. Checkout.jsx) handles these errors directly.
const NO_AUTO_REDIRECT = ["/orders", "/payments/"];

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err.config?.url || "";
    const isAuthEndpoint    = url.includes("/auth/");
    const isCheckoutEndpoint = NO_AUTO_REDIRECT.some((p) => url.includes(p));

    if (
      err.response?.status === 401 &&
      !isAuthEndpoint &&
      !isCheckoutEndpoint &&
      window.location.pathname !== "/login"
    ) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      // Dispatch a custom event so AuthContext / React Router handle navigation
      // without a hard page reload, preserving the SPA state.
      window.dispatchEvent(new CustomEvent("auth:logout"));
    }
    return Promise.reject(err);
  }
);

export default api;
