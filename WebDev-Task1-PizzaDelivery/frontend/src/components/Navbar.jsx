import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const { totalItems } = useCart();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);
  const handleLogout = () => { logout(); navigate("/login"); };

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand" onClick={close}>
        Cravello<span className="navbar-brand-dot" />
      </Link>

      <button className="navbar-toggle" onClick={() => setOpen(!open)} aria-label="Toggle menu">
        {open ? "✕" : "☰"}
      </button>

      <div className={`navbar-links ${open ? "open" : ""}`}>
        <NavLink to="/menu" onClick={close}>Menu</NavLink>
        <NavLink to="/builder" onClick={close}>Build Your Pizza</NavLink>

        <NavLink to="/cart" className="cart-link" onClick={close}>
          🛒 Cart {totalItems > 0 && <span className="cart-badge">{totalItems}</span>}
        </NavLink>

        {user ? (
          <>
            <NavLink to="/orders" onClick={close}>My Orders</NavLink>
            <span className="navbar-divider" />
            <NavLink to="/profile" onClick={close}>{user.name.split(" ")[0]}</NavLink>
            {user.role === "admin" && (
              <NavLink to="/admin" onClick={close} style={{ color: "var(--red)", fontWeight: 700 }}>Admin ↗</NavLink>
            )}
            <button className="btn-ghost" onClick={handleLogout}>Logout</button>
          </>
        ) : (
          <>
            <NavLink to="/login" onClick={close}>Login</NavLink>
            <Link to="/register" className="btn-primary-sm" onClick={close}>Sign Up</Link>
          </>
        )}
      </div>
    </nav>
  );
}
