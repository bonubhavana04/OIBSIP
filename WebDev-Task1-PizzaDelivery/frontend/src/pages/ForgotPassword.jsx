import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import toast from "react-hot-toast";

export default function ForgotPassword() {
  const [email, setEmail]   = useState("");
  const [sent, setSent]     = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Backend always returns 200 regardless of whether email exists (anti-enumeration)
      await api.post("/auth/forgot-password", { email });
      setSent(true);
    } catch (err) {
      // Only show an error for server failures (5xx), not for 200 responses
      toast.error(err.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" className="auth-logo">
          Cravello
          <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "var(--red)", marginLeft: 2, verticalAlign: "middle" }} />
        </Link>

        {sent ? (
          <div style={{ textAlign: "center" }}>
            <span style={{ fontSize: "3rem", display: "block", marginBottom: "1rem" }}>📬</span>
            <h2>Check your inbox</h2>
            <p className="auth-sub" style={{ marginBottom: "1.5rem" }}>
              If <strong>{email}</strong> is registered, you'll receive a reset link shortly.
              The link expires in <strong>1 hour</strong>.
            </p>
            <p style={{ fontSize: "0.82rem", color: "var(--charcoal-soft)", marginBottom: "1.5rem" }}>
              Check your spam folder if you don't see it.
            </p>
            <Link to="/login" className="btn-primary" style={{ display: "block", textAlign: "center" }}>
              Back to Login
            </Link>
          </div>
        ) : (
          <>
            <h2>Forgot Password</h2>
            <p className="auth-sub">Enter your email and we'll send you a reset link.</p>

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="form-group">
                <label htmlFor="email">Email address</label>
                <input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <button
                type="submit"
                className="btn-primary"
                style={{ width: "100%", marginTop: "0.5rem" }}
                disabled={loading}
              >
                {loading ? "Sending…" : "Send Reset Link"}
              </button>
            </form>

            <p className="auth-footer">
              <Link to="/login">← Back to Login</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
