import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../api/axios";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token          = searchParams.get("token");

  const [status, setStatus] = useState("loading"); // "loading" | "success" | "error"
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("No verification token found in the link.");
      return;
    }

    api.get(`/auth/verify-email?token=${token}`)
      .then(({ data }) => {
        setStatus("success");
        setMessage(data.message);
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err.response?.data?.message || "Verification failed. The link may have expired.");
      });
  }, [token]);

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ textAlign: "center" }}>
        <Link to="/" className="auth-logo" style={{ display: "block", marginBottom: "1.5rem" }}>
          Cravello
          <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "var(--red)", marginLeft: 2, verticalAlign: "middle" }} />
        </Link>

        {status === "loading" && (
          <>
            <div className="spinner" style={{ margin: "0 auto 1rem" }} />
            <p style={{ color: "var(--charcoal-soft)" }}>Verifying your email…</p>
          </>
        )}

        {status === "success" && (
          <>
            <span style={{ fontSize: "3rem", display: "block", marginBottom: "1rem" }}>✅</span>
            <h2>Email Verified!</h2>
            <p className="auth-sub" style={{ marginBottom: "1.5rem" }}>{message}</p>
            <Link to="/login" className="btn-primary" style={{ display: "block", textAlign: "center" }}>
              Sign In
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <span style={{ fontSize: "3rem", display: "block", marginBottom: "1rem" }}>❌</span>
            <h2>Verification Failed</h2>
            <p className="auth-sub" style={{ marginBottom: "1.5rem" }}>{message}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <Link to="/login" className="btn-primary" style={{ display: "block", textAlign: "center" }}>
                Back to Login
              </Link>
              <Link to="/register" className="btn-outline" style={{ display: "block", textAlign: "center" }}>
                Create New Account
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
