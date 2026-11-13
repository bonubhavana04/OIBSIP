import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import toast from "react-hot-toast";

const EyeIcon = ({ open }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {open ? (
      <>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ) : (
      <>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </>
    )}
  </svg>
);

export default function AdminLogin() {
  const { user, saveSession } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user?.role === "admin") navigate("/admin", { replace: true });
  }, [user, navigate]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/admin/login", form);
      saveSession(data.token, data.user);
      toast.success("Welcome back, Admin!");
      navigate("/admin", { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || "Invalid credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page" style={{ background: "linear-gradient(150deg, #1e1e1e 0%, #2d2d2d 100%)" }}>
      <div className="auth-card">
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.75rem" }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: "1.6rem", fontWeight: 800, color: "var(--red)" }}>
            Cravello
          </span>
          <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "var(--red)" }} />
          <span style={{
            marginLeft: "0.25rem", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.1em",
            textTransform: "uppercase", background: "var(--charcoal)", color: "white",
            padding: "2px 8px", borderRadius: "var(--r-full)",
          }}>
            Admin
          </span>
        </div>

        {/* Sign In / Sign Up tabs */}
        <div style={{ display: "flex", gap: 0, marginBottom: "1.75rem", borderBottom: "2px solid var(--cream-border)" }}>
          {[
            { label: "Sign In", to: "/admin-login",    active: true  },
            { label: "Sign Up", to: "/admin-register", active: false },
          ].map(({ label, to, active }) => (
            <Link
              key={label}
              to={to}
              style={{
                flex: 1, textAlign: "center", padding: "0.6rem 0",
                fontWeight: 700, fontSize: "0.9rem", textDecoration: "none",
                color: active ? "var(--red)" : "var(--charcoal-soft)",
                borderBottom: active ? "2px solid var(--red)" : "2px solid transparent",
                marginBottom: "-2px", transition: "color 0.2s",
              }}
            >
              {label}
            </Link>
          ))}
        </div>

        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.65rem", fontWeight: 700, marginBottom: "0.3rem" }}>
          Admin Portal
        </h2>
        <p className="auth-sub">Sign in with your administrator account</p>

        {error && (
          <div style={{
            background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "var(--r-sm)",
            padding: "0.85rem 1rem", marginBottom: "1rem", fontSize: "0.85rem", color: "#b91c1c",
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email address</label>
            <input
              id="email" type="email" placeholder="admin@example.com"
              value={form.email} onChange={(e) => set("email", e.target.value)}
              required autoComplete="email" autoFocus
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div style={{ position: "relative" }}>
              <input
                id="password" type={showPw ? "text" : "password"}
                placeholder="••••••••" value={form.password}
                onChange={(e) => set("password", e.target.value)}
                required autoComplete="current-password"
                style={{ paddingRight: "2.75rem" }}
              />
              <button
                type="button" onClick={() => setShowPw((v) => !v)}
                style={{
                  position: "absolute", right: "0.75rem", top: "50%",
                  transform: "translateY(-50%)", background: "none",
                  border: "none", cursor: "pointer",
                  color: "var(--charcoal-soft)", padding: 0,
                  display: "flex", alignItems: "center",
                }}
                aria-label={showPw ? "Hide password" : "Show password"}
              >
                <EyeIcon open={showPw} />
              </button>
            </div>
          </div>

          <button
            type="submit" className="btn-primary"
            style={{ width: "100%", marginTop: "0.75rem" }}
            disabled={loading}
          >
            {loading ? "Signing in…" : "Sign In to Admin Panel"}
          </button>
        </form>

        <p className="auth-footer" style={{ marginTop: "1.25rem" }}>
          Not an admin?{" "}
          <Link to="/login" style={{ color: "var(--red)", fontWeight: 600 }}>Customer login →</Link>
        </p>
      </div>
    </div>
  );
}
