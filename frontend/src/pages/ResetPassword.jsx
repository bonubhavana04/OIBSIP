import { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import toast from "react-hot-toast";

export default function ResetPassword() {
  const [searchParams]  = useSearchParams();
  const token           = searchParams.get("token");
  const navigate        = useNavigate();
  const { updateUser }  = useAuth();

  const [form, setForm]   = useState({ password: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.password.length < 8) return setError("Password must be at least 8 characters");
    if (form.password !== form.confirm) return setError("Passwords do not match");

    setLoading(true);
    try {
      // Backend validates the token, updates the password, and returns a new JWT
      const { data } = await api.post("/auth/reset-password", {
        token,
        password: form.password,
      });
      // Save the session so the user is logged in immediately
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      updateUser(data.user);
      toast.success("Password updated! You're now logged in.");
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || "Reset failed. The link may have expired.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: "center" }}>
          <span style={{ fontSize: "3rem", display: "block", marginBottom: "1rem" }}>🔗</span>
          <h2>Invalid Link</h2>
          <p className="auth-sub" style={{ marginBottom: "1.5rem" }}>
            This reset link is missing or has expired.
          </p>
          <Link to="/forgot-password" className="btn-primary" style={{ display: "block", textAlign: "center" }}>
            Request a New Link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" className="auth-logo">
          Cravello
          <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "var(--red)", marginLeft: 2, verticalAlign: "middle" }} />
        </Link>

        <h2>Reset Password</h2>
        <p className="auth-sub">Choose a new password for your account.</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="password">New Password</label>
            <input
              id="password"
              type="password"
              placeholder="Min. 8 characters"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <div className="form-group">
            <label htmlFor="confirm">Confirm Password</label>
            <input
              id="confirm"
              type="password"
              placeholder="Repeat password"
              value={form.confirm}
              onChange={(e) => set("confirm", e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          {error && <p className="form-error">{error}</p>}
          <button
            type="submit"
            className="btn-primary"
            style={{ width: "100%", marginTop: "0.5rem" }}
            disabled={loading}
          >
            {loading ? "Updating…" : "Reset Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
