import { useEffect, useState, useCallback } from "react";
import api from "../../api/axios";
import AdminLayout from "../../components/AdminLayout";
import toast from "react-hot-toast";

const CATEGORIES = ["base", "sauce", "cheese", "veggie"];

const REASON_LABEL = {
  order_deduction:    "Order deduction",
  order_cancellation: "Order cancelled",
  manual_adjustment:  "Manual adjustment",
  restock:            "Restock",
  payment_failure:    "Payment failed",
};

const BLANK_FORM = { name: "", category: "base", priceP: 0, stock: -1, emoji: "🍕", description: "", lowStockThreshold: 10 };

export default function AdminInventory() {
  const [items, setItems]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState("all");

  // Stock mutation modal
  const [modal, setModal]       = useState(null); // { item, mode: "restock"|"adjust" }
  const [inputVal, setInputVal] = useState("");
  const [noteVal, setNoteVal]   = useState("");
  const [saving, setSaving]     = useState(false);

  // Audit log drawer
  const [logItem, setLogItem]         = useState(null);
  const [logs, setLogs]               = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Create ingredient panel
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(BLANK_FORM);
  const [creating, setCreating]     = useState(false);

  // Recipe editor
  const [recipeItem, setRecipeItem]     = useState(null); // pizza doc
  const [pizzas, setPizzas]             = useState([]);
  const [pizzaSearch, setPizzaSearch]   = useState("");
  const [recipe, setRecipe]             = useState([]);   // [{ ingredientId, qty }]
  const [recipeLoading, setRecipeLoading] = useState(false);
  const [recipeSaving, setRecipeSaving]   = useState(false);
  const [showRecipe, setShowRecipe]       = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/inventory?includeUnavailable=true");
      setItems(res.data.items);
    } catch {
      toast.error("Failed to load inventory");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // ── Audit log ──────────────────────────────────────────────────────────────
  const openLogs = async (item) => {
    setLogItem(item);
    setLogsLoading(true);
    setLogs([]);
    try {
      const res = await api.get(`/inventory/${item._id}/logs?limit=30`);
      setLogs(res.data.logs);
    } catch {
      toast.error("Failed to load audit log");
    } finally {
      setLogsLoading(false);
    }
  };

  // ── Stock mutation ─────────────────────────────────────────────────────────
  const openModal = (item, mode) => {
    setModal({ item, mode });
    setInputVal(mode === "adjust" ? String(item.stock) : "");
    setNoteVal("");
  };

  const handleSave = async () => {
    const val = parseInt(inputVal, 10);
    if (isNaN(val)) return toast.error("Enter a valid number");
    if (modal.mode === "restock" && val <= 0) return toast.error("Quantity must be > 0");
    if (modal.mode === "adjust" && val < -1)  return toast.error("Stock must be >= -1");

    setSaving(true);
    try {
      const endpoint = modal.mode === "restock"
        ? `/inventory/${modal.item._id}/restock`
        : `/inventory/${modal.item._id}/adjust`;
      const body = modal.mode === "restock"
        ? { quantity: val, note: noteVal }
        : { stock: val,    note: noteVal };

      await api.put(endpoint, body);
      toast.success(modal.mode === "restock" ? `Added ${val} units` : `Stock set to ${val}`);
      setModal(null);
      fetchItems();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update stock");
    } finally {
      setSaving(false);
    }
  };

  // ── Availability toggle ────────────────────────────────────────────────────
  const toggleAvailability = async (item) => {
    try {
      await api.put(`/inventory/${item._id}`, { isAvailable: !item.isAvailable });
      toast.success(`${item.name} ${item.isAvailable ? "disabled" : "enabled"}`);
      fetchItems();
    } catch {
      toast.error("Failed to update availability");
    }
  };

  // ── Delete ingredient ──────────────────────────────────────────────────────
  const handleDelete = async (item) => {
    if (!window.confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/inventory/${item._id}`);
      toast.success(`"${item.name}" deleted`);
      fetchItems();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete ingredient");
    }
  };

  // ── Create ingredient ──────────────────────────────────────────────────────
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!createForm.name.trim()) return toast.error("Name is required");
    setCreating(true);
    try {
      await api.post("/inventory", {
        ...createForm,
        priceP: Math.round(Number(createForm.priceP) * 100),
        stock:  Number(createForm.stock),
        lowStockThreshold: Number(createForm.lowStockThreshold),
      });
      toast.success(`"${createForm.name}" created`);
      setShowCreate(false);
      setCreateForm(BLANK_FORM);
      fetchItems();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create ingredient");
    } finally {
      setCreating(false);
    }
  };

  // ── Recipe editor ──────────────────────────────────────────────────────────
  const openRecipeEditor = async () => {
    setShowRecipe(true);
    if (pizzas.length === 0) {
      try {
        const res = await api.get("/pizzas?limit=100");
        setPizzas(res.data.pizzas || []);
      } catch {
        toast.error("Failed to load pizzas");
      }
    }
  };

  const loadRecipe = async (pizza) => {
    setRecipeItem(pizza);
    setRecipeLoading(true);
    try {
      const res = await api.get(`/inventory/pizza/${pizza._id}/ingredients`);
      setRecipe(
        res.data.recipe.map((r) => ({
          ingredientId: r.ingredient._id,
          name:         r.ingredient.name,
          category:     r.ingredient.category,
          qty:          r.qty,
        }))
      );
    } catch {
      toast.error("Failed to load recipe");
    } finally {
      setRecipeLoading(false);
    }
  };

  const addRecipeRow = () => {
    if (items.length === 0) return;
    setRecipe((prev) => [
      ...prev,
      { ingredientId: items[0]._id, name: items[0].name, category: items[0].category, qty: 1 },
    ]);
  };

  const updateRecipeRow = (idx, field, value) => {
    setRecipe((prev) => {
      const next = [...prev];
      if (field === "ingredientId") {
        const ing = items.find((i) => i._id === value);
        next[idx] = { ...next[idx], ingredientId: value, name: ing?.name || "", category: ing?.category || "" };
      } else {
        next[idx] = { ...next[idx], [field]: value };
      }
      return next;
    });
  };

  const removeRecipeRow = (idx) => setRecipe((prev) => prev.filter((_, i) => i !== idx));

  const saveRecipe = async () => {
    if (!recipeItem) return;
    for (const row of recipe) {
      if (!Number.isInteger(Number(row.qty)) || Number(row.qty) < 1) {
        return toast.error("All quantities must be positive integers");
      }
    }
    setRecipeSaving(true);
    try {
      await api.put(`/inventory/pizza/${recipeItem._id}/ingredients`, {
        ingredients: recipe.map((r) => ({ ingredientId: r.ingredientId, qty: Number(r.qty) })),
      });
      toast.success(`Recipe saved for "${recipeItem.name}"`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save recipe");
    } finally {
      setRecipeSaving(false);
    }
  };

  // ── Derived display ────────────────────────────────────────────────────────
  const displayed = activeTab === "all" ? items : items.filter((i) => i.category === activeTab);
  const isLow     = (item) => item.stock !== -1 && item.stock <= item.lowStockThreshold;
  const avail     = (item) => item.stock === -1 ? "∞" : Math.max(0, item.stock - (item.reservedStock || 0));

  const filteredPizzas = pizzas.filter((p) =>
    p.name.toLowerCase().includes(pizzaSearch.toLowerCase())
  );

  return (
    <AdminLayout pageTitle="Inventory">
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <p style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--red)", marginBottom: "0.25rem" }}>
              Admin Panel
            </p>
            <h2 className="section-title" style={{ margin: 0 }}>Inventory</h2>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button className="btn-outline-sm" onClick={openRecipeEditor}>🍕 Pizza Recipes</button>
            <button className="btn-primary-sm" onClick={() => setShowCreate(true)}>+ New Ingredient</button>
          </div>
        </div>

        {/* Category tabs */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
          {["all", ...CATEGORIES].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={activeTab === tab ? "btn-primary-sm" : "btn-outline-sm"}
            >
              {tab === "all" ? "All" : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="loading"><div className="spinner" /></div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div className="table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Ingredient</th>
                    <th>Category</th>
                    <th>Physical Stock</th>
                    <th>Reserved</th>
                    <th>Available</th>
                    <th>Threshold</th>
                    <th>Stock Status</th>
                    <th>Availability</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.length === 0 && (
                    <tr><td colSpan={9} style={{ textAlign: "center", padding: "2rem", color: "var(--charcoal-soft)" }}>No items in this category.</td></tr>
                  )}
                  {displayed.map((item) => (
                    <tr key={item._id} style={isLow(item) ? { background: "var(--amber-light)" } : {}}>
                      <td>
                        <span style={{ marginRight: "0.4rem" }}>{item.emoji}</span>
                        <strong>{item.name}</strong>
                        {isLow(item) && (
                          <span style={{ marginLeft: "0.5rem", fontSize: "0.72rem", background: "var(--amber)", color: "white", borderRadius: "4px", padding: "1px 6px" }}>
                            LOW
                          </span>
                        )}
                      </td>
                      <td style={{ textTransform: "capitalize" }}>{item.category}</td>
                      <td style={{ fontWeight: 600 }}>{item.stock === -1 ? "Unlimited" : item.stock}</td>
                      <td style={{ color: "var(--charcoal-soft)" }}>{item.stock === -1 ? "—" : (item.reservedStock || 0)}</td>
                      <td style={{ fontWeight: 700, color: isLow(item) ? "var(--amber)" : "var(--green)" }}>{avail(item)}</td>
                      <td style={{ color: "var(--charcoal-soft)" }}>{item.stock === -1 ? "—" : item.lowStockThreshold}</td>
                      <td>
                        {item.stock === -1 ? (
                          <span className="status-badge confirmed">Unlimited</span>
                        ) : isLow(item) ? (
                          <span className="status-badge pending">Low Stock</span>
                        ) : (
                          <span className="status-badge delivered">In Stock</span>
                        )}
                      </td>
                      <td>
                        <button
                          onClick={() => toggleAvailability(item)}
                          className={item.isAvailable ? "btn-outline-sm" : "btn-primary-sm"}
                          style={{ fontSize: "0.75rem" }}
                        >
                          {item.isAvailable ? "Enabled" : "Disabled"}
                        </button>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                          <button className="btn-primary-sm" onClick={() => openModal(item, "restock")}>+ Add</button>
                          <button className="btn-outline-sm" onClick={() => openModal(item, "adjust")}>Set</button>
                          <button className="btn-ghost" onClick={() => openLogs(item)} style={{ fontSize: "0.78rem" }}>Logs</button>
                          <button className="btn-ghost danger" onClick={() => handleDelete(item)} style={{ fontSize: "0.78rem" }}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Create Ingredient Modal ── */}
        {showCreate && (
          <div style={overlayStyle} onClick={() => setShowCreate(false)}>
            <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
              <h3 style={{ marginBottom: "1rem" }}>New Ingredient</h3>
              <form onSubmit={handleCreate}>
                <div className="form-row" style={{ gap: "0.75rem" }}>
                  <div className="form-group" style={{ flex: 2 }}>
                    <label>Name *</label>
                    <input value={createForm.name} onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} required autoFocus />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Emoji</label>
                    <input value={createForm.emoji} onChange={(e) => setCreateForm((f) => ({ ...f, emoji: e.target.value }))} maxLength={4} />
                  </div>
                </div>
                <div className="form-row" style={{ gap: "0.75rem" }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Category *</label>
                    <select value={createForm.category} onChange={(e) => setCreateForm((f) => ({ ...f, category: e.target.value }))}>
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Price (₹ surcharge)</label>
                    <input type="number" min={0} step={0.01} value={createForm.priceP} onChange={(e) => setCreateForm((f) => ({ ...f, priceP: e.target.value }))} />
                  </div>
                </div>
                <div className="form-row" style={{ gap: "0.75rem" }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Initial Stock (-1 = unlimited)</label>
                    <input type="number" min={-1} value={createForm.stock} onChange={(e) => setCreateForm((f) => ({ ...f, stock: e.target.value }))} />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Low-stock alert threshold</label>
                    <input type="number" min={0} value={createForm.lowStockThreshold} onChange={(e) => setCreateForm((f) => ({ ...f, lowStockThreshold: e.target.value }))} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <input value={createForm.description} onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))} />
                </div>
                <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "1.25rem" }}>
                  <button type="button" className="btn-outline" onClick={() => setShowCreate(false)}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={creating}>{creating ? "Creating…" : "Create"}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Stock Mutation Modal ── */}
        {modal && (
          <div style={overlayStyle} onClick={() => setModal(null)}>
            <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
              <h3 style={{ marginBottom: "1rem" }}>
                {modal.mode === "restock" ? "Add Stock" : "Set Stock"} — {modal.item.emoji} {modal.item.name}
              </h3>
              <div className="form-group">
                <label>{modal.mode === "restock" ? "Units to add" : "New stock value (-1 = unlimited)"}</label>
                <input
                  type="number"
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  min={modal.mode === "restock" ? 1 : -1}
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Note (optional)</label>
                <input type="text" value={noteVal} onChange={(e) => setNoteVal(e.target.value)} placeholder="Reason for change" />
              </div>
              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "1.25rem" }}>
                <button className="btn-outline" onClick={() => setModal(null)}>Cancel</button>
                <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Audit Log Drawer ── */}
        {logItem && (
          <div style={overlayStyle} onClick={() => setLogItem(null)}>
            <div style={{ ...modalStyle, width: "min(700px, 95vw)", maxHeight: "80vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <h3 style={{ margin: 0 }}>Audit Log — {logItem.emoji} {logItem.name}</h3>
                <button className="btn-ghost" onClick={() => setLogItem(null)}>✕</button>
              </div>
              {logsLoading ? (
                <div className="loading"><div className="spinner" /></div>
              ) : logs.length === 0 ? (
                <p style={{ color: "var(--charcoal-soft)", textAlign: "center", padding: "2rem" }}>No log entries yet.</p>
              ) : (
                <table className="admin-table" style={{ fontSize: "0.82rem" }}>
                  <thead>
                    <tr>
                      <th>Date</th><th>Reason</th><th>Delta</th><th>Before → After</th><th>By</th><th>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log._id}>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {new Date(log.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td>{REASON_LABEL[log.reason] || log.reason}</td>
                        <td style={{ fontWeight: 700, color: log.delta > 0 ? "var(--green)" : "var(--red)" }}>
                          {log.delta > 0 ? `+${log.delta}` : log.delta}
                        </td>
                        <td>{log.stockBefore} → {log.stockAfter}</td>
                        <td>{log.performedBy?.name || "System"}</td>
                        <td style={{ color: "var(--charcoal-soft)" }}>{log.note || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ── Pizza Recipe Editor ── */}
        {showRecipe && (
          <div style={overlayStyle} onClick={() => { setShowRecipe(false); setRecipeItem(null); }}>
            <div style={{ ...modalStyle, width: "min(860px, 95vw)", maxHeight: "85vh", overflowY: "auto", display: "flex", gap: "1.5rem" }} onClick={(e) => e.stopPropagation()}>
              {/* Pizza list */}
              <div style={{ width: "220px", flexShrink: 0, borderRight: "1px solid var(--border)", paddingRight: "1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                  <h3 style={{ margin: 0, fontSize: "0.95rem" }}>Pizzas</h3>
                  <button className="btn-ghost" onClick={() => { setShowRecipe(false); setRecipeItem(null); }}>✕</button>
                </div>
                <input
                  placeholder="Search…"
                  value={pizzaSearch}
                  onChange={(e) => setPizzaSearch(e.target.value)}
                  style={{ width: "100%", marginBottom: "0.5rem", fontSize: "0.82rem" }}
                />
                <div style={{ maxHeight: "60vh", overflowY: "auto" }}>
                  {filteredPizzas.map((p) => (
                    <button
                      key={p._id}
                      onClick={() => loadRecipe(p)}
                      style={{
                        display: "block", width: "100%", textAlign: "left",
                        padding: "0.5rem 0.6rem", borderRadius: "var(--r-sm)",
                        background: recipeItem?._id === p._id ? "var(--red)" : "transparent",
                        color: recipeItem?._id === p._id ? "white" : "inherit",
                        border: "none", cursor: "pointer", fontSize: "0.84rem",
                        marginBottom: "2px",
                      }}
                    >
                      {p.name}
                    </button>
                  ))}
                  {filteredPizzas.length === 0 && (
                    <p style={{ fontSize: "0.8rem", color: "var(--charcoal-soft)", padding: "0.5rem" }}>No pizzas found</p>
                  )}
                </div>
              </div>

              {/* Recipe editor */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {!recipeItem ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--charcoal-soft)" }}>
                    Select a pizza to edit its ingredient recipe
                  </div>
                ) : recipeLoading ? (
                  <div className="loading"><div className="spinner" /></div>
                ) : (
                  <>
                    <h3 style={{ marginBottom: "1rem" }}>Recipe — {recipeItem.name}</h3>
                    <p style={{ fontSize: "0.78rem", color: "var(--charcoal-soft)", marginBottom: "1rem" }}>
                      These quantities are consumed per pizza ordered. Menu pizzas without a recipe skip inventory tracking.
                    </p>
                    <table className="admin-table" style={{ fontSize: "0.84rem", marginBottom: "0.75rem" }}>
                      <thead>
                        <tr><th>Ingredient</th><th>Category</th><th style={{ width: "80px" }}>Qty / pizza</th><th></th></tr>
                      </thead>
                      <tbody>
                        {recipe.length === 0 && (
                          <tr><td colSpan={4} style={{ textAlign: "center", color: "var(--charcoal-soft)", padding: "1rem" }}>No ingredients — add one below</td></tr>
                        )}
                        {recipe.map((row, idx) => (
                          <tr key={idx}>
                            <td>
                              <select
                                value={row.ingredientId}
                                onChange={(e) => updateRecipeRow(idx, "ingredientId", e.target.value)}
                                style={{ fontSize: "0.82rem", width: "100%" }}
                              >
                                {items.map((i) => (
                                  <option key={i._id} value={i._id}>{i.emoji} {i.name}</option>
                                ))}
                              </select>
                            </td>
                            <td style={{ textTransform: "capitalize", color: "var(--charcoal-soft)", fontSize: "0.78rem" }}>{row.category}</td>
                            <td>
                              <input
                                type="number" min={1} value={row.qty}
                                onChange={(e) => updateRecipeRow(idx, "qty", parseInt(e.target.value, 10) || 1)}
                                style={{ width: "60px", fontSize: "0.82rem" }}
                              />
                            </td>
                            <td>
                              <button className="btn-ghost danger" onClick={() => removeRecipeRow(idx)} style={{ fontSize: "0.78rem" }}>✕</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ display: "flex", gap: "0.75rem", justifyContent: "space-between", alignItems: "center" }}>
                      <button className="btn-outline-sm" onClick={addRecipeRow}>+ Add ingredient</button>
                      <button className="btn-primary" onClick={saveRecipe} disabled={recipeSaving}>
                        {recipeSaving ? "Saving…" : "Save Recipe"}
                      </button>
                    </div>
                  </>
                )}
              </div>
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
  padding: "2rem", width: "min(520px, 95vw)",
  boxShadow: "var(--shadow-xl)",
};
