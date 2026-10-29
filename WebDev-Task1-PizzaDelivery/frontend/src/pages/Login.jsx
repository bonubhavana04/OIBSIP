import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import toast from "react-hot-toast";

export default function Login() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const from      = location.state?.from?.pathname || "/";

  const [form, setForm]           = useState({ email: "", password: "" });
  const [loading, setLoading]     = useState(false);
  const [unverified, setUnverified] = useState(false);
  const [resending, setResending] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setUnverified(false);
    try {
      await login(form.email, form.password);
      toast.success("Welcome back!");
      navigate(from, { replace: true });
    } catch (err) {
      const data = err.response?.data;
      if (data?.code === "EMAIL_NOT_VERIFIED") {
        setUnverified(true);
      } else {
        toast.error(data?.message || "Login failed. Check your credentials.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!form.email) return toast.error("Enter your email address first");
    setResending(true);
    try {
      await api.post("/auth/resend-verification", { email: form.email });
      toast.success("Verification email sent — check your inbox.");
      setUnverified(false);
    } catch {
      toast.error("Could not resend. Please try again.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" className="auth-logo">
          Cravello
          <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "var(--red)", marginLeft: 2, verticalAlign: "middle" }} />
        </Link>

        <h2>Welcome Back</h2>
        <p className="auth-sub">Sign in to your Cravello account</p>

        {/* Unverified email banner */}
        {unverified && (
          <div style={{
            background: "#fef3c7", border: "1px solid #f59e0b", borderRadius: "var(--r-sm)",
            padding: "0.85rem 1rem", marginBottom: "1rem", fontSize: "0.85rem", color: "#92400e",
          }}>
            <p style={{ fontWeight: 600, marginBottom: "0.35rem" }}>📧 Email not verified</p>
            <p>Please verify your email before logging in.</p>
            <button
              className="btn-outline-sm"
              style={{ marginTop: "0.5rem" }}
              onClick={handleResend}
              disabled={resending}
            >
              {resending ? "Sending…" : "Resend verification email"}
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <Link to="/forgot-password" className="forgot-link">Forgot password?</Link>

          <button
            type="submit"
            className="btn-primary"
            style={{ width: "100%", marginTop: "0.5rem" }}
            disabled={loading}
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <p className="auth-footer">
          Don't have an account? <Link to="/register">Create one</Link>
        </p>
      </div>
    </div>
  );
}
