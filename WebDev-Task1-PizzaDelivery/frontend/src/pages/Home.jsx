import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import PizzaCard from "../components/PizzaCard";

export default function Home() {
  const [featured, setFeatured] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    api.get("/pizzas?isFeatured=true")
      .then(({ data }) => setFeatured(data.pizzas))
      .catch(() => setFeatured([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      {/* ── Hero ── */}
      <section className="hero-section">
        <div className="hero-content">
          <span className="hero-eyebrow">🍕 Fresh · Handcrafted · Delivered</span>
          <h1>
            Pizza Worth<br />
            <span className="accent">Every Craving</span>
          </h1>
          <p>
            Artisan pizzas made with premium ingredients — at your door in 45 minutes or less.
            Choose from our menu or build your own masterpiece.
          </p>
          <div className="hero-actions">
            <Link to="/menu" className="btn-primary">Order Now</Link>
            <Link to="/builder" className="btn-outline">Build Your Pizza</Link>
          </div>
        </div>

        <div className="hero-stats">
          {[
            { value: "12+",    label: "Signature Pizzas" },
            { value: "45 min", label: "Avg. Delivery" },
            { value: "4.8 ★",  label: "Customer Rating" },
            { value: "100%",   label: "Fresh Daily" },
          ].map((s) => (
            <div key={s.label}>
              <p className="hero-stat-value">{s.value}</p>
              <p className="hero-stat-label">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Featured Pizzas ── */}
      <section className="section">
        <p className="section-eyebrow">Hand-picked for you</p>
        <h2 className="section-title">Featured Pizzas</h2>

        {loading ? (
          <div className="loading"><div className="spinner" /></div>
        ) : featured.length === 0 ? (
          <div className="empty-state" style={{ padding: "2rem" }}>
            <span className="empty-state-icon">🍕</span>
            <p>No featured pizzas right now.</p>
            <Link to="/menu" className="btn-outline" style={{ marginTop: "1rem" }}>Browse Full Menu</Link>
          </div>
        ) : (
          <div className="pizza-grid">
            {featured.map((p, i) => <PizzaCard key={p._id} pizza={p} index={i} />)}
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: "2.5rem" }}>
          <Link to="/menu" className="btn-outline">View Full Menu →</Link>
        </div>
      </section>

      {/* ── Builder CTA ── */}
      <section style={{
        background: "linear-gradient(135deg, var(--charcoal) 0%, #2d1a1a 100%)",
        padding: "4rem 2rem",
        textAlign: "center",
      }}>
        <p style={{ color: "var(--red)", fontWeight: 700, fontSize: "0.78rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.75rem" }}>
          Your Pizza, Your Rules
        </p>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.8rem, 4vw, 2.8rem)", color: "white", marginBottom: "1rem", fontWeight: 800 }}>
          Build Your Own Pizza
        </h2>
        <p style={{ color: "rgba(255,255,255,0.65)", marginBottom: "2rem", maxWidth: "480px", margin: "0 auto 2rem", lineHeight: 1.7 }}>
          Choose your base, sauce, cheese, and toppings. We'll craft it fresh and deliver it hot.
        </p>
        <Link to="/builder" className="btn-primary">Start Building →</Link>
      </section>

      {/* ── Features ── */}
      <section className="features-section">
        {[
          { icon: "🌿", title: "Fresh Ingredients", desc: "Sourced daily from local farms, never frozen" },
          { icon: "⚡", title: "Fast Delivery",      desc: "45-minute guarantee or your next order is free" },
          { icon: "🔒", title: "Secure Payments",   desc: "Razorpay online or Cash on Delivery" },
          { icon: "🍕", title: "Build Your Own",    desc: "Fully customisable pizzas, your way" },
        ].map((f) => (
          <div key={f.title} className="feature-card">
            <span className="feature-icon">{f.icon}</span>
            <h3>{f.title}</h3>
            <p>{f.desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
