import { useEffect, useState } from "react";
import api from "../api/axios";
import PizzaCard from "../components/PizzaCard";

export default function Menu() {
  const [pizzas,     setPizzas]     = useState([]);
  const [categories, setCategories] = useState([]);
  const [filters,    setFilters]    = useState({ category: "", isVeg: "", sort: "newest", search: "" });
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(false);

  useEffect(() => {
    api.get("/pizzas/categories")
      .then(({ data }) => setCategories(data.categories))
      .catch(() => {}); // categories are cosmetic — silently ignore
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(false);
    const params = new URLSearchParams();
    if (filters.category) params.set("category", filters.category);
    if (filters.isVeg)    params.set("isVeg",    filters.isVeg);
    if (filters.sort)     params.set("sort",     filters.sort);
    if (filters.search)   params.set("search",   filters.search);

    api.get(`/pizzas?${params}`)
      .then(({ data }) => { setPizzas(data.pizzas); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [filters]);

  const set = (key, val) => setFilters((f) => ({ ...f, [key]: val }));

  return (
    <div className="section">
      <p className="section-eyebrow">What are you craving?</p>
      <h2 className="section-title">Our Menu</h2>

      <div className="menu-filters">
        {/* Search */}
        <div className="search-wrapper">
          <span className="search-icon">🔍</span>
          <input
            className="search-input"
            placeholder="Search pizzas…"
            value={filters.search}
            onChange={(e) => set("search", e.target.value)}
          />
        </div>

        {/* Category pills */}
        <div className="category-pills">
          <button
            className={`pill ${filters.category === "" ? "active" : ""}`}
            onClick={() => set("category", "")}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c._id}
              className={`pill ${filters.category === c._id ? "active" : ""}`}
              onClick={() => set("category", c._id)}
            >
              {c.emoji || "🍕"} {c.name}
            </button>
          ))}
        </div>

        {/* Filters row */}
        <div className="filter-row">
          <select className="select" value={filters.isVeg} onChange={(e) => set("isVeg", e.target.value)}>
            <option value="">Veg &amp; Non-Veg</option>
            <option value="true">🟢 Veg Only</option>
            <option value="false">🔴 Non-Veg Only</option>
          </select>

          <select className="select" value={filters.sort} onChange={(e) => set("sort", e.target.value)}>
            <option value="newest">Newest First</option>
            <option value="price_asc">Price: Low → High</option>
            <option value="price_desc">Price: High → Low</option>
            <option value="rating">Top Rated</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : error ? (
        <div className="empty-state">
          <span className="empty-state-icon">⚠️</span>
          <h2>Could not load menu</h2>
          <p>Please check your connection and try again.</p>
          <button className="btn-primary" onClick={() => setFilters((f) => ({ ...f }))}>
            Retry
          </button>
        </div>
      ) : pizzas.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-icon">🍕</span>
          <h2>No pizzas found</h2>
          <p>Try adjusting your filters or search term.</p>
          <button className="btn-outline" onClick={() => setFilters({ category: "", isVeg: "", sort: "newest", search: "" })}>
            Clear Filters
          </button>
        </div>
      ) : (
        <>
          <p style={{ fontSize: "0.82rem", color: "var(--charcoal-soft)", marginBottom: "1.25rem" }}>
            {pizzas.length} pizza{pizzas.length !== 1 ? "s" : ""} found
          </p>
          <div className="pizza-grid">
            {pizzas.map((p, i) => <PizzaCard key={p._id} pizza={p} index={i} />)}
          </div>
        </>
      )}
    </div>
  );
}
