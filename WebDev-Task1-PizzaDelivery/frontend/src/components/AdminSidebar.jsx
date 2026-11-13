import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const LogoutIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const MenuIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="3" y1="6"  x2="21" y2="6"  />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

const CloseIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6"  y1="6" x2="18" y2="18" />
  </svg>
);

export default function AdminSidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const doLogout = () => {
    setConfirmOpen(false);
    setMobileOpen(false);
    logout();
    navigate("/admin-login", { replace: true });
  };

  const close = () => setMobileOpen(false);

  const navLinks = (
    <>
      <p className="admin-sidebar-title">Management</p>
      <NavLink to="/admin" end className={({ isActive }) => `admin-nav-link ${isActive ? "active" : ""}`} onClick={close}>
        Dashboard
      </NavLink>
      <NavLink to="/admin/orders" className={({ isActive }) => `admin-nav-link ${isActive ? "active" : ""}`} onClick={close}>
        Orders
      </NavLink>
      <NavLink to="/admin/inventory" className={({ isActive }) => `admin-nav-link ${isActive ? "active" : ""}`} onClick={close}>
        Inventory
      </NavLink>
      <NavLink to="/admin/pizzas" className={({ isActive }) => `admin-nav-link ${isActive ? "active" : ""}`} onClick={close}>
        Pizzas
      </NavLink>

      <p className="admin-sidebar-title" style={{ marginTop: "1rem" }}>Store</p>
      <NavLink to="/admin/storefront" className={({ isActive }) => `admin-nav-link ${isActive ? "active" : ""}`} onClick={close}>Storefront</NavLink>
      <Link to="/home" className="admin-nav-link" onClick={close}>Customer Site</Link>
      <Link to="/menu" className="admin-nav-link" onClick={close}>Menu</Link>
    </>
  );

  const logoutBtn = (
    <button
      onClick={() => setConfirmOpen(true)}
      style={{
        display: "inline-flex", alignItems: "center", gap: "0.45rem",
        padding: "0.45rem 1rem", borderRadius: "var(--r-full)",
        background: "rgba(192,57,43,0.15)", border: "1px solid rgba(192,57,43,0.35)",
        color: "#f87171", fontSize: "0.82rem", fontWeight: 600,
        cursor: "pointer", transition: "all 0.2s", whiteSpace: "nowrap",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(192,57,43,0.28)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(192,57,43,0.15)"; }}
      aria-label="Logout"
    >
      <LogoutIcon />
      Logout
    </button>
  );

  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────────────────────────── */}
      <aside className="admin-sidebar">
        <Link
          to="/"
          style={{
            fontFamily: "var(--font-display)", fontSize: "1.35rem", fontWeight: 800,
            color: "white", textDecoration: "none", display: "flex", alignItems: "center",
            gap: "0.4rem", marginBottom: "2rem", paddingBottom: "1.25rem",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          Cravello
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--red)", display: "inline-block" }} />
        </Link>

        {user && (
          <div style={{ marginBottom: "1.5rem", padding: "0.75rem", background: "rgba(255,255,255,0.06)", borderRadius: "var(--r-sm)" }}>
            <p style={{ color: "white", fontWeight: 600, fontSize: "0.88rem" }}>{user.name}</p>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.75rem" }}>{user.email}</p>
          </div>
        )}

        {navLinks}
      </aside>

      {/* ── Desktop top header bar (logout lives here on desktop) ───────── */}
      <div className="admin-desktop-header">
        <div style={{ flex: 1 }} />
        {logoutBtn}
      </div>

      {/* ── Mobile top bar ───────────────────────────────────────────────── */}
      <div className="admin-mobile-bar">
        <Link to="/" style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem", fontWeight: 800, color: "white", textDecoration: "none" }}>
          Cravello
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {logoutBtn}
          <button
            onClick={() => setMobileOpen((o) => !o)}
            style={{ background: "none", border: "none", color: "white", cursor: "pointer", padding: "0.25rem", display: "flex" }}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      {/* ── Mobile drawer ────────────────────────────────────────────────── */}
      {mobileOpen && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 299, background: "rgba(0,0,0,0.5)" }}
          onClick={close}
        >
          <aside
            style={{
              position: "absolute", top: 0, left: 0, bottom: 0, width: "260px",
              background: "var(--charcoal)", padding: "4rem 1rem 1.5rem",
              display: "flex", flexDirection: "column", gap: "0.25rem",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {user && (
              <div style={{ marginBottom: "1.5rem", padding: "0.75rem", background: "rgba(255,255,255,0.06)", borderRadius: "var(--r-sm)" }}>
                <p style={{ color: "white", fontWeight: 600, fontSize: "0.88rem" }}>{user.name}</p>
                <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.75rem" }}>{user.email}</p>
              </div>
            )}
            {navLinks}
          </aside>
        </div>
      )}

      {/* ── Logout confirmation dialog ───────────────────────────────────── */}
      {confirmOpen && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 500,
            background: "rgba(0,0,0,0.6)", display: "flex",
            alignItems: "center", justifyContent: "center", padding: "1rem",
          }}
          onClick={() => setConfirmOpen(false)}
        >
          <div
            style={{
              background: "var(--white)", borderRadius: "var(--r-lg)",
              padding: "2rem", maxWidth: "360px", width: "100%",
              boxShadow: "var(--shadow-xl)", textAlign: "center",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <span style={{ fontSize: "2.5rem", display: "block", marginBottom: "0.75rem" }}>🔒</span>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem", fontWeight: 700, marginBottom: "0.5rem" }}>
              Sign out?
            </h3>
            <p style={{ color: "var(--charcoal-soft)", fontSize: "0.88rem", marginBottom: "1.5rem" }}>
              You will be redirected to the Admin Login page.
            </p>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
              <button
                onClick={() => setConfirmOpen(false)}
                style={{
                  flex: 1, padding: "0.65rem", borderRadius: "var(--r-full)",
                  border: "1.5px solid var(--cream-border)", background: "var(--cream)",
                  fontWeight: 600, fontSize: "0.88rem", cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={doLogout}
                className="btn-primary"
                style={{ flex: 1, padding: "0.65rem" }}
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
