import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AdminSidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate("/login"); };

  return (
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

      <p className="admin-sidebar-title">Management</p>
      <NavLink to="/admin" end className={({ isActive }) => `admin-nav-link ${isActive ? "active" : ""}`}>
        📊 Dashboard
      </NavLink>
      <NavLink to="/admin/orders" className={({ isActive }) => `admin-nav-link ${isActive ? "active" : ""}`}>
        📦 Orders
      </NavLink>
      <NavLink to="/admin/inventory" className={({ isActive }) => `admin-nav-link ${isActive ? "active" : ""}`}>
        🥫 Inventory
      </NavLink>

      <p className="admin-sidebar-title" style={{ marginTop: "1rem" }}>Store</p>
      <Link to="/" className="admin-nav-link">🏠 Storefront</Link>
      <Link to="/menu" className="admin-nav-link">🍕 Menu</Link>

      <div style={{ marginTop: "auto", paddingTop: "1.5rem" }}>
        <button
          onClick={handleLogout}
          style={{
            display: "flex", alignItems: "center", gap: "0.6rem",
            padding: "0.65rem 0.85rem", borderRadius: "var(--r-sm)",
            color: "rgba(255,255,255,0.6)", fontSize: "0.88rem", fontWeight: 500,
            background: "none", border: "none", cursor: "pointer", width: "100%",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "white"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
        >
          🚪 Logout
        </button>
      </div>
    </aside>
  );
}
