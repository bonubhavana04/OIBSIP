import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// ── Icons ─────────────────────────────────────────────────────────────────────

const Icon = ({ d, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
  </svg>
);

const LogoutIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const MenuIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

const CloseIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

// ── Sidebar nav links ─────────────────────────────────────────────────────────

function SidebarNav({ onLinkClick }) {
  return (
    <nav style={{ flex: 1 }}>
      <p className="al-nav-section">Management</p>
      <NavLink to="/admin" end className={({ isActive }) => `al-nav-link${isActive ? " active" : ""}`} onClick={onLinkClick}>
        Dashboard
      </NavLink>
      <NavLink to="/admin/orders" className={({ isActive }) => `al-nav-link${isActive ? " active" : ""}`} onClick={onLinkClick}>
        Orders
      </NavLink>
      <NavLink to="/admin/inventory" className={({ isActive }) => `al-nav-link${isActive ? " active" : ""}`} onClick={onLinkClick}>
        Inventory
      </NavLink>
      <NavLink to="/admin/pizzas" className={({ isActive }) => `al-nav-link${isActive ? " active" : ""}`} onClick={onLinkClick}>
        Pizzas
      </NavLink>

      <p className="al-nav-section" style={{ marginTop: "1.25rem" }}>Store</p>
      <NavLink to="/admin/storefront" className={({ isActive }) => `al-nav-link${isActive ? " active" : ""}`} onClick={onLinkClick}>
        Storefront
      </NavLink>
      <Link to="/" className="al-nav-link" onClick={onLinkClick}>Customer Site</Link>
      <Link to="/menu" className="al-nav-link" onClick={onLinkClick}>Menu</Link>
    </nav>
  );
}

// ── Main layout component ─────────────────────────────────────────────────────

export default function AdminLayout({ children, pageTitle }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const doLogout = () => {
    setConfirmOpen(false);
    setDrawerOpen(false);
    logout();
    navigate("/admin-login", { replace: true });
  };

  const closeDrawer = () => setDrawerOpen(false);

  const logoutBtn = (
    <button
      onClick={() => setConfirmOpen(true)}
      className="al-logout-btn"
      aria-label="Logout"
    >
      <LogoutIcon />
      Logout
    </button>
  );

  return (
    <div className="al-root">
      {/* ── Desktop sidebar ──────────────────────────────────────────────── */}
      <aside className="al-sidebar">
        {/* Brand */}
        <Link to="/" className="al-brand">
          Cravello
          <span className="al-brand-dot" />
        </Link>

        {/* Admin profile */}
        {user && (
          <div className="al-profile">
            <div className="al-profile-avatar">
              {user.name?.charAt(0).toUpperCase()}
            </div>
            <div className="al-profile-info">
              <p className="al-profile-name">{user.name}</p>
              <p className="al-profile-email">{user.email}</p>
            </div>
          </div>
        )}

        <SidebarNav onLinkClick={() => {}} />
      </aside>

      {/* ── Right column: header + main ──────────────────────────────────── */}
      <div className="al-body">
        {/* Desktop top header */}
        <header className="al-header">
          <div className="al-header-title">
            {pageTitle && <span className="al-page-title">{pageTitle}</span>}
          </div>
          <div className="al-header-right">
            {user && (
              <span className="al-header-user">
                {user.name}
              </span>
            )}
            {logoutBtn}
          </div>
        </header>

        {/* Mobile top bar */}
        <div className="al-mobile-bar">
          <Link to="/" className="al-mobile-brand">Cravello</Link>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            {logoutBtn}
            <button
              onClick={() => setDrawerOpen((o) => !o)}
              className="al-hamburger"
              aria-label="Toggle menu"
            >
              {drawerOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        {drawerOpen && (
          <div className="al-drawer-overlay" onClick={closeDrawer}>
            <aside className="al-drawer" onClick={(e) => e.stopPropagation()}>
              {user && (
                <div className="al-profile" style={{ marginBottom: "1.25rem" }}>
                  <div className="al-profile-avatar">
                    {user.name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="al-profile-info">
                    <p className="al-profile-name">{user.name}</p>
                    <p className="al-profile-email">{user.email}</p>
                  </div>
                </div>
              )}
              <SidebarNav onLinkClick={closeDrawer} />
            </aside>
          </div>
        )}

        {/* Page content */}
        <main className="al-main">
          {children}
        </main>
      </div>

      {/* ── Logout confirmation ───────────────────────────────────────────── */}
      {confirmOpen && (
        <div className="al-confirm-overlay" onClick={() => setConfirmOpen(false)}>
          <div className="al-confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <span style={{ fontSize: "2.5rem", display: "block", marginBottom: "0.75rem" }}>🔒</span>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem", fontWeight: 700, marginBottom: "0.5rem" }}>
              Sign out?
            </h3>
            <p style={{ color: "var(--charcoal-soft)", fontSize: "0.88rem", marginBottom: "1.5rem" }}>
              You will be redirected to the Admin Login page.
            </p>
            <div style={{ display: "flex", gap: "0.75rem" }}>
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
              <button onClick={doLogout} className="btn-primary" style={{ flex: 1, padding: "0.65rem" }}>
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
