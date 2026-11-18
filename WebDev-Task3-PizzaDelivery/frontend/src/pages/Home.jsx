import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import PizzaCard from "../components/PizzaCard";

// ── Announcement Bar ──────────────────────────────────────────────────────────
function AnnouncementBar({ announcement }) {
  const [dismissed, setDismissed] = useState(false);
  if (!announcement || dismissed) return null;

  const bg = {
    promo:   "var(--red)",
    info:    "#1d4ed8",
    warning: "var(--amber)",
  }[announcement.style] || "var(--red)";

  return (
    <div style={{
      background: bg, color: "white", textAlign: "center",
      padding: "0.55rem 3rem", fontSize: "0.85rem", fontWeight: 600,
      position: "relative", letterSpacing: "0.01em",
    }}>
      {announcement.text}
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        style={{
          position: "absolute", right: "1rem", top: "50%", transform: "translateY(-50%)",
          background: "none", border: "none", color: "white", cursor: "pointer",
          fontSize: "1.1rem", lineHeight: 1, opacity: 0.8,
        }}
      >×</button>
    </div>
  );
}

// ── Hero Banner (dynamic) ─────────────────────────────────────────────────────
function HeroBanner({ banners }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (banners.length <= 1) return;
    const t = setInterval(() => setCurrent((c) => (c + 1) % banners.length), 5000);
    return () => clearInterval(t);
  }, [banners.length]);

  if (!banners.length) {
    return (
      <section className="hero-section">
        <div className="hero-content">
          <span className="hero-eyebrow">🍕 Fresh · Handcrafted · Delivered</span>
          <h1>Pizza Worth<br /><span className="accent">Every Craving</span></h1>
          <p>Artisan pizzas made with premium ingredients — at your door in 45 minutes or less.</p>
          <div className="hero-actions">
            <Link to="/menu" className="btn-primary">Order Now</Link>
            <Link to="/builder" className="btn-outline">Build Your Pizza</Link>
          </div>
        </div>
        <div className="hero-stats">
          {[
            { value: "12+", label: "Signature Pizzas" },
            { value: "45 min", label: "Avg. Delivery" },
            { value: "4.8 ★", label: "Customer Rating" },
            { value: "100%", label: "Fresh Daily" },
          ].map((s) => (
            <div key={s.label}>
              <p className="hero-stat-value">{s.value}</p>
              <p className="hero-stat-label">{s.label}</p>
            </div>
          ))}
        </div>
      </section>
    );
  }

  const banner = banners[current];
  return (
    <section
      className="hero-section"
      style={banner.image ? {
        backgroundImage: `linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)), url(${banner.image})`,
        backgroundSize: "cover", backgroundPosition: "center",
      } : {}}
    >
      <div className="hero-content">
        <h1 style={banner.image ? { color: "white" } : {}}>{banner.heading}</h1>
        {banner.description && (
          <p style={banner.image ? { color: "rgba(255,255,255,0.85)" } : {}}>{banner.description}</p>
        )}
        {banner.ctaLabel && banner.ctaUrl && (
          <div className="hero-actions">
            <Link to={banner.ctaUrl} className="btn-primary">{banner.ctaLabel}</Link>
          </div>
        )}
      </div>
      {banners.length > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem", marginTop: "1.5rem" }}>
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              aria-label={`Banner ${i + 1}`}
              style={{
                width: 10, height: 10, borderRadius: "50%", border: "none", cursor: "pointer",
                background: i === current ? "var(--red)" : "rgba(255,255,255,0.5)",
                padding: 0,
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// ── Section renderer ──────────────────────────────────────────────────────────
function SectionRenderer({ sectionKey, config, featured, categories }) {
  if (sectionKey === "hero") return null;

  if (sectionKey === "featured") {
    return (
      <section className="section">
        <p className="section-eyebrow">Hand-picked for you</p>
        <h2 className="section-title">{config?.heading || "Featured Pizzas"}</h2>
        {featured.length === 0 ? (
          <div className="empty-state" style={{ padding: "2rem" }}>
            <span className="empty-state-icon">🍕</span>
            <p>No featured pizzas right now.</p>
            <Link to="/menu" className="btn-outline" style={{ marginTop: "1rem" }}>Browse Full Menu</Link>
          </div>
        ) : (
          <>
            <div className="pizza-grid">
              {featured.map((p, i) => <PizzaCard key={p._id} pizza={p} index={i} />)}
            </div>
            <div style={{ textAlign: "center", marginTop: "2.5rem" }}>
              <Link to="/menu" className="btn-outline">View Full Menu →</Link>
            </div>
          </>
        )}
      </section>
    );
  }

  if (sectionKey === "builder") {
    return (
      <section style={{
        background: "linear-gradient(135deg, var(--charcoal) 0%, #2d1a1a 100%)",
        padding: "4rem 2rem", textAlign: "center",
      }}>
        <p style={{ color: "var(--red)", fontWeight: 700, fontSize: "0.78rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.75rem" }}>
          Your Pizza, Your Rules
        </p>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.8rem, 4vw, 2.8rem)", color: "white", marginBottom: "1rem", fontWeight: 800 }}>
          {config?.heading || "Build Your Own Pizza"}
        </h2>
        <p style={{ color: "rgba(255,255,255,0.65)", marginBottom: "2rem", maxWidth: "480px", margin: "0 auto 2rem", lineHeight: 1.7 }}>
          {config?.subheading || "Choose your base, sauce, cheese, and toppings. We'll craft it fresh and deliver it hot."}
        </p>
        <Link to="/builder" className="btn-primary">Start Building →</Link>
      </section>
    );
  }

  if (sectionKey === "features") {
    return (
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
    );
  }

  if (sectionKey === "categories") {
    if (!categories.length) return null;
    return (
      <section className="section">
        <p className="section-eyebrow">Explore by type</p>
        <h2 className="section-title">{config?.heading || "Popular Categories"}</h2>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "center" }}>
          {categories.map((cat) => (
            <Link
              key={cat._id}
              to={`/menu?category=${cat._id}`}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                gap: "0.5rem", padding: "1.25rem 1.75rem",
                background: "var(--white)", borderRadius: "var(--r-lg)",
                border: "1px solid var(--cream-border)", boxShadow: "var(--shadow-xs)",
                textDecoration: "none", color: "var(--charcoal)",
                transition: "transform 0.15s, box-shadow 0.15s",
                minWidth: 120,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "var(--shadow)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "var(--shadow-xs)"; }}
            >
              <span style={{ fontSize: "2rem" }}>{cat.emoji || "🍕"}</span>
              <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{cat.name}</span>
            </Link>
          ))}
        </div>
      </section>
    );
  }

  return null;
}

// ── Main Home component ───────────────────────────────────────────────────────
export default function Home() {
  const [storefront, setStorefront] = useState(null);
  const [categories, setCategories] = useState([]);
  const [sfLoading, setSfLoading]   = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/storefront/published"),
      api.get("/pizzas/categories"),
    ])
      .then(([sfRes, catRes]) => {
        setStorefront(sfRes.data);
        setCategories(catRes.data.categories || []);
      })
      .catch(() => {})
      .finally(() => setSfLoading(false));
  }, []);

  const sections     = storefront?.sections       || [];
  const banners      = storefront?.banners        || [];
  const featured     = storefront?.featuredPizzas || [];
  const announcement = storefront?.announcement;

  const visibleSections = sections
    .filter((s) => s.isVisible)
    .sort((a, b) => a.order - b.order);

  const sectionMap = Object.fromEntries(sections.map((s) => [s.key, s]));
  const heroConfig = sectionMap["hero"];
  const showHero   = !heroConfig || heroConfig.isVisible !== false;

  return (
    <div>
      <AnnouncementBar announcement={announcement} />

      {showHero && <HeroBanner banners={banners} />}

      {sfLoading ? (
        <div className="loading" style={{ padding: "4rem" }}><div className="spinner" /></div>
      ) : (
        visibleSections
          .filter((s) => s.key !== "hero")
          .map((s) => (
            <SectionRenderer
              key={s.key}
              sectionKey={s.key}
              config={sectionMap[s.key]}
              featured={featured}
              categories={categories}
            />
          ))
      )}
    </div>
  );
}
