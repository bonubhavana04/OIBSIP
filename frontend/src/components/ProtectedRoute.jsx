import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Blocks unauthenticated users — redirects to /login (or /admin-login for admin routes)
export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user, initializing } = useAuth();
  const location = useLocation();

  if (initializing) return <div className="loading"><div className="spinner" /></div>;

  if (!user) {
    // Admin routes redirect to the admin login portal
    if (adminOnly) return <Navigate to="/admin-login" state={{ from: location }} replace />;
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // A non-admin trying to access an admin page → back to storefront
  if (adminOnly && user.role !== "admin") return <Navigate to="/" replace />;

  return children;
}

// Blocks already-authenticated customers from visiting /login and /register.
// Admins are allowed through so they can log in with a customer account.
export function PublicOnlyRoute({ children }) {
  const { user, initializing } = useAuth();
  if (initializing) return <div className="loading"><div className="spinner" /></div>;
  if (user && user.role !== "admin") return <Navigate to="/home" replace />;
  return children;
}
