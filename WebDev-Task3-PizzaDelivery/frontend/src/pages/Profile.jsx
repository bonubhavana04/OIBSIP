import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import toast from "react-hot-toast";

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [form,      setForm]      = useState({ name: user?.name || "", phone: user?.phone || "" });
  const [loading,   setLoading]   = useState(false);
  const [pwForm,    setPwForm]    = useState({ current: "", next: "", confirm: "" });
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError,   setPwError]   = useState("");

  const set   = (k, v) => setForm((f)   => ({ ...f, [k]: v }));
  const setPw = (k, v) => setPwForm((f) => ({ ...f, [k]: v }));

  const handleProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.put("/auth/profile", { name: form.name, phone: form.phone });
      updateUser(data.user);
      toast.success("Profile updated!");
    } catch (err) {
      toast.error(err.response?.data?.message || "Update failed");
    } finally {
      setLoading(false);
    }
  };

  const handlePassword = async (e) => {
    e.preventDefault();
    setPwError("");
    if (pwForm.next.length < 8) return setPwError("New password must be at least 8 characters");
    if (pwForm.next !== pwForm.confirm) return setPwError("Passwords do not match");

    setPwLoading(true);
    try {
      const { data } = await api.put("/auth/change-password", {
        currentPassword: pwForm.current,
        newPassword:     pwForm.next,
      });
      // Backend returns a fresh token — update localStorage so the session stays valid
      localStorage.setItem("token", data.token);
      updateUser(data.user);
      setPwForm({ current: "", next: "", confirm: "" });
      toast.success("Password updated!");
    } catch (err) {
      setPwError(err.response?.data?.message || "Password change failed");
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <div className="section" style={{ maxWidth: 720 }}>
      <p className="section-eyebrow">Account</p>
      <h2 className="section-title">My Profile</h2>

      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {/* Account info */}
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: "var(--red)", color: "white",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "1.4rem", fontWeight: 800, fontFamily: "var(--font-display)",
              flexShrink: 0,
            }}>
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div>
              <p style={{ fontWeight: 700, fontSize: "1.05rem" }}>{user?.name}</p>
              <p style={{ color: "var(--charcoal-soft)", fontSize: "0.85rem" }}>{user?.email}</p>
              <span className={`status-badge ${user?.role === "admin" ? "confirmed" : "delivered"}`} style={{ marginTop: "4px" }}>
                {user?.role}
              </span>
            </div>
          </div>

          <form onSubmit={handleProfile}>
            <div className="form-row">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="name">Full Name</label>
                <input id="name" type="text" value={form.name} onChange={(e) => set("name", e.target.value)} required />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="phone">Phone</label>
                <input id="phone" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91 98765 43210" />
              </div>
            </div>
            <div className="form-group">
              <label>Email address</label>
              <input type="email" value={user?.email} disabled style={{ opacity: 0.6, cursor: "not-allowed" }} />
            </div>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Saving…" : "Save Changes"}
            </button>
          </form>
        </div>

        {/* Change password */}
        <div className="card">
          <h3 style={{ marginBottom: "1rem" }}>Change Password</h3>
          <form onSubmit={handlePassword}>
            <div className="form-group">
              <label>Current Password</label>
              <input
                type="password"
                value={pwForm.current}
                onChange={(e) => setPw("current", e.target.value)}
                required
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
            <div className="form-row">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>New Password</label>
                <input
                  type="password"
                  value={pwForm.next}
                  onChange={(e) => setPw("next", e.target.value)}
                  required
                  placeholder="Min. 8 chars"
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Confirm New</label>
                <input
                  type="password"
                  value={pwForm.confirm}
                  onChange={(e) => setPw("confirm", e.target.value)}
                  required
                  placeholder="Repeat"
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
            </div>
            {pwError && <p className="form-error" style={{ marginTop: "0.5rem" }}>{pwError}</p>}
            <button type="submit" className="btn-outline" disabled={pwLoading} style={{ marginTop: "1rem" }}>
              {pwLoading ? "Updating…" : "Update Password"}
            </button>
          </form>
        </div>

        {/* Saved addresses */}
        {user?.addresses?.length > 0 && (
          <div className="card">
            <h3 style={{ marginBottom: "1rem" }}>Saved Addresses</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {user.addresses.map((addr, i) => (
                <div key={i} style={{
                  background: "var(--cream)", borderRadius: "var(--r-sm)", padding: "0.85rem 1rem",
                  border: "1px solid var(--cream-border)", fontSize: "0.88rem", color: "var(--charcoal-mid)",
                }}>
                  {addr.label && <p style={{ fontWeight: 700, marginBottom: "0.25rem" }}>{addr.label}</p>}
                  <p>{addr.street}, {addr.city}, {addr.state} — {addr.pincode}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
