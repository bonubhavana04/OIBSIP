import { createContext, useContext, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("user")); } catch { return null; }
  });
  // true while the initial /auth/me validation is in-flight
  const [initializing, setInitializing] = useState(() => !!localStorage.getItem("token"));

  // Listen for the auth:logout event dispatched by the Axios interceptor
  // when a non-checkout endpoint returns 401. Use React Router navigate so
  // the redirect is a SPA transition (no full page reload).
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  useEffect(() => { navigateRef.current = navigate; }, [navigate]);

  useEffect(() => {
    const handler = () => {
      setUser(null);
      navigateRef.current("/", { replace: true });
    };
    window.addEventListener("auth:logout", handler);
    return () => window.removeEventListener("auth:logout", handler);
  }, []);

  // On mount: silently validate the stored token.
  // Clears stale/expired sessions without redirecting.
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { setInitializing(false); return; }
    api.get("/auth/me")
      .then(({ data }) => {
        localStorage.setItem("user", JSON.stringify(data.user));
        setUser(data.user);
      })
      .catch(() => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setUser(null);
      })
      .finally(() => setInitializing(false));
  }, []);

  const saveSession = (token, userData) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
  };

  /**
   * login — throws on failure.
   * Throws with err.code === "EMAIL_NOT_VERIFIED" when account is unverified.
   */
  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    saveSession(data.token, data.user);
    return data.user;
  };

  /**
   * register — creates account only, does NOT log in.
   * Backend sends a verification email; caller should redirect to /login
   * with a message telling the user to check their inbox.
   */
  const register = async (name, email, password, phone) => {
    const { data } = await api.post("/auth/register", { name, email, password, phone });
    return data; // { message: "Account created. Please check your email…" }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  const updateUser = (updated) => {
    localStorage.setItem("user", JSON.stringify(updated));
    setUser(updated);
  };

  return (
    <AuthContext.Provider value={{ user, initializing, login, register, logout, updateUser, saveSession }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
