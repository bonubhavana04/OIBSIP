import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Blocks unauthenticated users — redirects to /login, preserving intended destination
export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user, initializing } = useAuth();
  const location = useLocation();

  // Wait for the initial /auth/me check to finish before deciding to redirect.
  // Without this, a valid session causes a flash redirect to /login on hard refresh.
  if (initializing) return <div className="loading"><div className="spinner" /></div>;

  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (adminOnly && user.role !== "admin") return <Navigate to="/" replace />;

  return children;
}

// Blocks already-authenticated users from visiting /login and /register
export function PublicOnlyRoute({ children }) {
  const { user, initializing } = useAuth();
  if (initializing) return <div className="loading"><div className="spinner" /></div>;
  if (user) return <Navigate to="/" replace />;
  return children;
}
