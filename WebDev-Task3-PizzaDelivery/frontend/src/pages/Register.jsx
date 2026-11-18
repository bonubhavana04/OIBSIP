import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

export default function Register() {
  const { register } = useAuth();
  const navigate     = useNavigate();
  const [form, setForm]   = useState({ name: "", email: "", phone: "", password: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) return toast.error("Passwords do not match");
    if (form.password.length < 8) return toast.error("Password must be at least 8 characters");
    setLoading(true);
    try {
      await register(form.name, form.email, form.password, form.phone);
      setRegistered(true);
    } catch (err) {
      toast.error(err.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  if (registered) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: "center" }}>
          <Link to="/" className="auth-logo" style={{ display: "block", marginBottom: "1.5rem" }}>
            Cravello
            <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "var(--red)", marginLeft: 2, verticalAlign: "middle" }} />
          </Link>
          <span style={{ fontSize: "3rem", display: "block", marginBottom: "1rem" }}>📬</span>
          <h2>Check your inbox</h2>
          <p className="auth-sub" style={{ marginBottom: "1.5rem" }}>
            We sent a verification link to <strong>{form.email}</strong>.
            Click it to activate your account, then sign in.
          </p>
          <p style={{ fontSize: "0.82rem", color: "var(--charcoal-soft)", marginBottom: "1.5rem" }}>
            Didn't receive it? Check your spam folder or{" "}
            <Link to="/login" style={{ color: "var(--red)", fontWeight: 600 }}>go to login</Link>{" "}
            to request a new link.
          </p>
          <Link to="/login" className="btn-primary" style={{ display: "block", textAlign: "center" }}>
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  const fields = [
    { key: "name",     label: "Full Name",         type: "text",     placeholder: "Jane Doe",          auto: "name" },
    { key: "email",    label: "Email address",      type: "email",    placeholder: "you@example.com",   auto: "email" },
    { key: "phone",    label: "Phone (optional)",   type: "tel",      placeholder: "+91 98765 43210",   auto: "tel",          optional: true },
    { key: "password", label: "Password",           type: "password", placeholder: "Min. 8 characters", auto: "new-password" },
    { key: "confirm",  label: "Confirm Password",   type: "password", placeholder: "Repeat password",   auto: "new-password" },
  ];

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" className="auth-logo">
          Cravello
          <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "var(--red)", marginLeft: 2, verticalAlign: "middle" }} />
        </Link>

        <h2>Create Account</h2>
        <p className="auth-sub">Join Cravello and start ordering</p>

        <form onSubmit={handleSubmit} className="auth-form">
          {fields.map(({ key, label, type, placeholder, auto, optional }) => (
            <div key={key} className="form-group">
              <label htmlFor={key}>{label}</label>
              <input
                id={key}
                type={type}
                placeholder={placeholder}
                value={form[key]}
                onChange={(e) => set(key, e.target.value)}
                required={!optional}
                autoComplete={auto}
                minLength={key === "password" || key === "confirm" ? 8 : undefined}
              />
            </div>
          ))}

          <button
            type="submit"
            className="btn-primary"
            style={{ width: "100%", marginTop: "0.5rem" }}
            disabled={loading}
          >
            {loading ? "Creating account…" : "Create Account"}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account? <Link to="/login">Sign In</Link>
        </p>
      </div>
    </div>
  );
}
