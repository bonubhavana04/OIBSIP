import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/* ── Splash Screen ─────────────────────────────────────────── */
function SplashScreen({ onDone }) {
  useEffect(() => {
    // Respect prefers-reduced-motion — skip straight to role selection
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const delay = reduced ? 0 : 2600;
    const t = setTimeout(onDone, delay);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="splash-screen" aria-hidden="true">
      {/* Decorative pizza rings */}
      <div className="splash-ring splash-ring-1" />
      <div className="splash-ring splash-ring-2" />

      {/* Floating ingredient dots */}
      <span className="splash-dot splash-dot-1">🍅</span>
      <span className="splash-dot splash-dot-2">🫒</span>
      <span className="splash-dot splash-dot-3">🧀</span>
      <span className="splash-dot splash-dot-4">🌿</span>

      <div className="splash-center">
        {/* Pizza icon */}
        <div className="splash-pizza">🍕</div>

        {/* Brand name */}
        <h1 className="splash-brand">Cravello</h1>

        {/* Tagline */}
        <p className="splash-tagline">Crafted with passion. Delivered with love.</p>

        {/* Loading bar */}
        <div className="splash-bar"><div className="splash-bar-fill" /></div>
      </div>
    </div>
  );
}

/* ── Role Selection ────────────────────────────────────────── */
function RoleSelection() {
  const navigate = useNavigate();

  const goCustomer = () => navigate("/login");

  const goAdmin = () => navigate("/admin-login");

  return (
    <div className="role-page">
      {/* Background decoration */}
      <div className="role-bg-circle role-bg-circle-1" />
      <div className="role-bg-circle role-bg-circle-2" />

      <div className="role-container">
        {/* Header */}
        <div className="role-header">
          <span className="role-logo">Cravello<span className="role-logo-dot" /></span>
          <h2 className="role-heading">Welcome to Cravello!</h2>
          <p className="role-sub">Choose how you would like to experience Cravello.</p>
        </div>

        {/* Cards */}
        <div className="role-cards">
          {/* Customer card */}
          <button className="role-card role-card-customer" onClick={goCustomer}>
            <div className="role-card-icon">🍕</div>
            <div className="role-card-badge">Customer</div>
            <h3 className="role-card-title">I'm a Customer</h3>
            <p className="role-card-desc">
              Discover delicious pizzas, customize your favourite combinations, and enjoy a
              delightful ordering experience.
            </p>
            <span className="role-card-cta">Continue as Customer →</span>
          </button>

          {/* Admin card */}
          <button className="role-card role-card-admin" onClick={goAdmin}>
            <div className="role-card-icon">🛡️</div>
            <div className="role-card-badge role-card-badge-admin">Admin</div>
            <h3 className="role-card-title">I'm an Admin</h3>
            <p className="role-card-desc">
              Manage restaurant operations, monitor inventory, track orders, and oversee your
              pizza business.
            </p>
            <span className="role-card-cta role-card-cta-admin">Continue as Admin →</span>
          </button>
        </div>

        <p className="role-footer">
          Secure · Role-based access · Powered by Cravello
        </p>
      </div>
    </div>
  );
}

/* ── Welcome orchestrator ──────────────────────────────────── */
export default function Welcome() {
  const { initializing } = useAuth();
  // Use sessionStorage so splash only plays once per browser session,
  // not on every internal navigation or page refresh within the session.
  const [showSplash, setShowSplash] = useState(
    () => !sessionStorage.getItem("cravello_splash_done")
  );

  const handleSplashDone = () => {
    sessionStorage.setItem("cravello_splash_done", "1");
    setShowSplash(false);
  };

  // While auth is initializing, keep showing splash (or a blank screen if
  // splash already played) so we don't flash the role-selection before
  // knowing whether the user is already logged in.
  if (initializing) {
    return showSplash ? <SplashScreen onDone={() => {}} /> : (
      <div className="loading"><div className="spinner" /></div>
    );
  }

  if (showSplash) return <SplashScreen onDone={handleSplashDone} />;

  return <RoleSelection />;
}
