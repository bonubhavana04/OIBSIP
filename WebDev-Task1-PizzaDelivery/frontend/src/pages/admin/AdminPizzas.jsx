import { useEffect, useState, useCallback } from "react";
import api from "../../api/axios";
import AdminLayout from "../../components/AdminLayout";
import toast from "react-hot-toast";

const SIZES = ["Small", "Medium", "Large"];
const BLANK_PIZZA = {
  name: "", description: "", category: "", isVeg: true,
  isAvailable: true, isFeatured: false, isBestseller: false, isNewArrival: false,
  spiceLevel: "mild", image: "",
  sizes: [
    { label: "Small",  priceP: 0 },
    { label: "Medium", priceP: 0 },
    { label: "Large",  priceP: 0 },
  ],
};
const BLANK_CAT = { name: "", emoji: "🍕" };

export default function AdminPizzas() {
  const [pizzas, setPizzas]         = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [activeTab, setActiveTab]   = useState("pizzas"); // "pizzas" | "categories"

  // Pizza modal
  const [pizzaModal, setPizzaModal] = useState(null); // null | { mode:"create"|"edit", data }
  const [pizzaSaving, setPizzaSaving] = useState(false);

  // Category modal
  const [catModal, setCatModal]   = useState(null);
  const [catSaving, setCatSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, cRes] = await Promise.all([
        api.get("/pizzas?includeUnavailable=true"),
        api.get("/pizzas/categories"),
      ]);
      setPizzas(pRes.data.pizzas || []);
      setCategories(cRes.data.categories || []);
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Pizza CRUD ─────────────────────────────────────────────────────────────
  const openCreatePizza = () => setPizzaModal({ mode: "create", data: { ...BLANK_PIZZA } });
  const openEditPizza   = (p) => setPizzaModal({
    mode: "edit",
    data: {
      ...p,
      sizes: SIZES.map((label) => {
        const existing = p.sizes.find((s) => s.label === label);
        return { label, priceP: existing ? Math.round(existing.priceP / 100) : 0 };
      }),
    },
  });

  const setPizzaField = (key, val) =>
    setPizzaModal((m) => ({ ...m, data: { ...m.data, [key]: val } }));

  const setSizePrice = (label, val) =>
    setPizzaModal((m) => ({
      ...m,
      data: {
        ...m.data,
        sizes: m.data.sizes.map((s) => s.label === label ? { ...s, priceP: val } : s),
      },
    }));

  const savePizza = async (e) => {
    e.preventDefault();
    const d = pizzaModal.data;
    if (!d.name.trim())     return toast.error("Name is required");
    if (!d.category)        return toast.error("Category is required");
    if (d.sizes.some((s) => !s.priceP || Number(s.priceP) <= 0))
      return toast.error("All sizes need a price > 0");

    const payload = {
      ...d,
      sizes: d.sizes.map((s) => ({ label: s.label, priceP: Math.round(Number(s.priceP) * 100) })),
    };

    setPizzaSaving(true);
    try {
      if (pizzaModal.mode === "create") {
        await api.post("/pizzas", payload);
        toast.success(`"${d.name}" created`);
      } else {
        await api.put(`/pizzas/${d._id}`, payload);
        toast.success(`"${d.name}" updated`);
      }
      setPizzaModal(null);
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || "Save failed");
    } finally {
      setPizzaSaving(false);
    }
  };

  const deletePizza = async (p) => {
    if (!window.confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/pizzas/${p._id}`);
      toast.success(`"${p.name}" deleted`);
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || "Delete failed");
    }
  };

  const togglePizzaAvailability = async (p) => {
    try {
      await api.put(`/pizzas/${p._id}`, { isAvailable: !p.isAvailable });
      toast.success(`"${p.name}" ${p.isAvailable ? "hidden" : "shown"}`);
      fetchAll();
    } catch {
      toast.error("Update failed");
    }
  };

  // ── Category CRUD ──────────────────────────────────────────────────────────
  const openCreateCat = () => setCatModal({ mode: "create", data: { ...BLANK_CAT } });
  const openEditCat   = (c) => setCatModal({ mode: "edit", data: { ...c } });

  const saveCat = async (e) => {
    e.preventDefault();
    const d = catModal.data;
    if (!d.name.trim()) return toast.error("Name is required");
    setCatSaving(true);
    try {
      if (catModal.mode === "create") {
        await api.post("/pizzas/categories", d);
        toast.success(`Category "${d.name}" created`);
      } else {
        await api.put(`/pizzas/categories/${d._id}`, d);
        toast.success(`Category "${d.name}" updated`);
      }
      setCatModal(null);
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || "Save failed");
    } finally {
      setCatSaving(false);
    }
  };

  const deleteCat = async (c) => {
    if (!window.confirm(`Delete category "${c.name}"? Only possible if no pizzas use it.`)) return;
    try {
      await api.delete(`/pizzas/categories/${c._id}`);
      toast.success(`Category "${c.name}" deleted`);
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || "Delete failed");
    }
  };

  return (
    <AdminLayout pageTitle="Menu Management">
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <p style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--red)", marginBottom: "0.25rem" }}>
              Admin Panel
            </p>
            <h2 className="section-title" style={{ margin: 0 }}>Menu Management</h2>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {activeTab === "pizzas"
              ? <button className="btn-primary-sm" onClick={openCreatePizza}>+ New Pizza</button>
              : <button className="btn-primary-sm" onClick={openCreateCat}>+ New Category</button>
            }
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
          <button className={activeTab === "pizzas" ? "btn-primary-sm" : "btn-outline-sm"} onClick={() => setActiveTab("pizzas")}>
            🍕 Pizzas ({pizzas.length})
          </button>
          <button className={activeTab === "categories" ? "btn-primary-sm" : "btn-outline-sm"} onClick={() => setActiveTab("categories")}>
            📂 Categories ({categories.length})
          </button>
        </div>

        {loading ? (
          <div className="loading"><div className="spinner" /></div>
        ) : activeTab === "pizzas" ? (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div className="table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Sizes & Prices</th>
                    <th>Type</th>
                    <th>Spice</th>
                    <th>Labels</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pizzas.length === 0 && (
                    <tr><td colSpan={8} style={{ textAlign: "center", padding: "2rem", color: "var(--charcoal-soft)" }}>No pizzas yet</td></tr>
                  )}
                  {pizzas.map((p) => (
                    <tr key={p._id} style={!p.isAvailable ? { opacity: 0.55 } : {}}>
                      <td>
                        <p style={{ fontWeight: 600 }}>{p.name}</p>
                        {p.description && <p style={{ fontSize: "0.75rem", color: "var(--charcoal-soft)" }}>{p.description.slice(0, 50)}{p.description.length > 50 ? "…" : ""}</p>}
                      </td>
                      <td style={{ fontSize: "0.85rem" }}>{p.category?.emoji} {p.category?.name || "—"}</td>
                      <td style={{ fontSize: "0.8rem" }}>
                        {p.sizes.map((s) => (
                          <span key={s.label} style={{ display: "block" }}>
                            {s.label}: ₹{Math.round(s.priceP / 100)}
                          </span>
                        ))}
                      </td>
                      <td>
                        <span style={{ fontSize: "0.8rem" }}>{p.isVeg ? "🟢 Veg" : "🔴 Non-Veg"}</span>
                      </td>
                      <td style={{ fontSize: "0.8rem", textTransform: "capitalize" }}>{p.spiceLevel || "mild"}</td>
                      <td style={{ fontSize: "0.75rem" }}>
                        {p.isFeatured   && <span style={{ display: "block" }}>⭐ Featured</span>}
                        {p.isBestseller && <span style={{ display: "block" }}>🏆 Bestseller</span>}
                        {p.isNewArrival && <span style={{ display: "block" }}>🆕 New</span>}
                        {!p.isFeatured && !p.isBestseller && !p.isNewArrival && "—"}
                      </td>
                      <td>
                        <button
                          className={p.isAvailable ? "btn-outline-sm" : "btn-primary-sm"}
                          style={{ fontSize: "0.75rem" }}
                          onClick={() => togglePizzaAvailability(p)}
                        >
                          {p.isAvailable ? "Visible" : "Hidden"}
                        </button>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "0.4rem" }}>
                          <button className="btn-outline-sm" onClick={() => openEditPizza(p)}>Edit</button>
                          <button className="btn-ghost danger" style={{ fontSize: "0.78rem" }} onClick={() => deletePizza(p)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div className="table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr><th>Emoji</th><th>Name</th><th>Pizzas</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {categories.length === 0 && (
                    <tr><td colSpan={4} style={{ textAlign: "center", padding: "2rem", color: "var(--charcoal-soft)" }}>No categories yet</td></tr>
                  )}
                  {categories.map((c) => (
                    <tr key={c._id}>
                      <td style={{ fontSize: "1.4rem" }}>{c.emoji}</td>
                      <td style={{ fontWeight: 600 }}>{c.name}</td>
                      <td style={{ color: "var(--charcoal-soft)", fontSize: "0.85rem" }}>
                        {pizzas.filter((p) => p.category?._id === c._id || p.category === c._id).length} pizza(s)
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "0.4rem" }}>
                          <button className="btn-outline-sm" onClick={() => openEditCat(c)}>Edit</button>
                          <button className="btn-ghost danger" style={{ fontSize: "0.78rem" }} onClick={() => deleteCat(c)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Pizza Modal ── */}
        {pizzaModal && (
          <div style={overlayStyle} onClick={() => setPizzaModal(null)}>
            <div style={{ ...modalStyle, width: "min(620px, 95vw)", maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
              <h3 style={{ marginBottom: "1.25rem" }}>
                {pizzaModal.mode === "create" ? "New Pizza" : `Edit — ${pizzaModal.data.name}`}
              </h3>
              <form onSubmit={savePizza}>
                <div className="form-row" style={{ gap: "0.75rem" }}>
                  <div className="form-group" style={{ flex: 2 }}>
                    <label>Name *</label>
                    <input value={pizzaModal.data.name} onChange={(e) => setPizzaField("name", e.target.value)} required autoFocus />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Category *</label>
                    <select value={pizzaModal.data.category?._id || pizzaModal.data.category || ""} onChange={(e) => setPizzaField("category", e.target.value)} required>
                      <option value="">Select…</option>
                      {categories.map((c) => <option key={c._id} value={c._id}>{c.emoji} {c.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Description</label>
                  <textarea value={pizzaModal.data.description || ""} onChange={(e) => setPizzaField("description", e.target.value)} rows={2} style={{ resize: "vertical" }} />
                </div>

                <div className="form-group">
                  <label>Image URL</label>
                  <input value={pizzaModal.data.image || ""} onChange={(e) => setPizzaField("image", e.target.value)} placeholder="https://…" />
                </div>

                <div style={{ marginBottom: "1rem" }}>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--charcoal-mid)" }}>
                    Prices (₹) *
                  </label>
                  <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                    {pizzaModal.data.sizes.map((s) => (
                      <div key={s.label} style={{ flex: 1, minWidth: "100px" }}>
                        <label style={{ fontSize: "0.78rem", color: "var(--charcoal-soft)", display: "block", marginBottom: "0.25rem" }}>{s.label}</label>
                        <input
                          type="number" min={1} step={1}
                          value={s.priceP}
                          onChange={(e) => setSizePrice(s.label, e.target.value)}
                          placeholder="₹"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
                  {[
                    { key: "isVeg",        label: "Vegetarian" },
                    { key: "isAvailable",  label: "Available" },
                    { key: "isFeatured",   label: "Featured on Home" },
                    { key: "isBestseller", label: "Bestseller" },
                    { key: "isNewArrival", label: "New Arrival" },
                  ].map(({ key, label }) => (
                    <label key={key} style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.88rem", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={!!pizzaModal.data[key]}
                        onChange={(e) => setPizzaField(key, e.target.checked)}
                      />
                      {label}
                    </label>
                  ))}
                </div>

                <div className="form-group" style={{ marginBottom: "1.25rem" }}>
                  <label>Spice Level</label>
                  <select value={pizzaModal.data.spiceLevel || "mild"} onChange={(e) => setPizzaField("spiceLevel", e.target.value)}>
                    <option value="mild">🟡 Mild</option>
                    <option value="medium">🟠 Medium</option>
                    <option value="hot">🔴 Hot</option>
                    <option value="extra-hot">🔥 Extra Hot</option>
                  </select>
                </div>

                <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
                  <button type="button" className="btn-outline" onClick={() => setPizzaModal(null)}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={pizzaSaving}>
                    {pizzaSaving ? "Saving…" : pizzaModal.mode === "create" ? "Create Pizza" : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Category Modal ── */}
        {catModal && (
          <div style={overlayStyle} onClick={() => setCatModal(null)}>
            <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
              <h3 style={{ marginBottom: "1rem" }}>
                {catModal.mode === "create" ? "New Category" : `Edit — ${catModal.data.name}`}
              </h3>
              <form onSubmit={saveCat}>
                <div className="form-row" style={{ gap: "0.75rem" }}>
                  <div className="form-group" style={{ flex: 2 }}>
                    <label>Name *</label>
                    <input value={catModal.data.name} onChange={(e) => setCatModal((m) => ({ ...m, data: { ...m.data, name: e.target.value } }))} required autoFocus />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Emoji</label>
                    <input value={catModal.data.emoji || ""} onChange={(e) => setCatModal((m) => ({ ...m, data: { ...m.data, emoji: e.target.value } }))} maxLength={4} />
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "1rem" }}>
                  <button type="button" className="btn-outline" onClick={() => setCatModal(null)}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={catSaving}>
                    {catSaving ? "Saving…" : catModal.mode === "create" ? "Create" : "Save"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
    </AdminLayout>
  );
}

const overlayStyle = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
};
const modalStyle = {
  background: "var(--white)", borderRadius: "var(--r-lg)",
  padding: "2rem", width: "min(480px, 95vw)",
  boxShadow: "var(--shadow-xl)",
};
