import { useEffect, useState, useCallback } from "react";
import api from "../../api/axios";
import AdminSidebar from "../../components/AdminSidebar";
import toast from "react-hot-toast";

const CATEGORIES = ["base", "sauce", "cheese", "veggie"];

const REASON_LABEL = {
  order_deduction:    "Order deduction",
  order_cancellation: "Order cancelled",
  manual_adjustment:  "Manual adjustment",
  restock:            "Restock",
  payment_failure:    "Payment failed",
};

export default function AdminInventory() {
  const [items, setItems]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState("all");

  // Restock / adjust modal
  const [modal, setModal]         = useState(null); // { item, mode: "restock"|"adjust" }
  const [inputVal, setInputVal]   = useState("");
  const [noteVal, setNoteVal]     = useState("");
  const [saving, setSaving]       = useState(false);

  // Audit log drawer
  const [logItem, setLogItem]     = useState(null);
  const [logs, setLogs]           = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);

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

  const toggleAvailability = async (item) => {
    try {
      await api.put(`/inventory/${item._id}`, { isAvailable: !item.isAvailable });
      toast.success(`${item.name} ${item.isAvailable ? "disabled" : "enabled"}`);
      fetchItems();
    } catch {
      toast.error("Failed to update availability");
    }
  };

  const displayed = activeTab === "all"
    ? items
    : items.filter((i) => i.category === activeTab);

  const isLow = (item) =>
    item.stock !== -1 && item.stock <= item.lowStockThreshold;

  const availableStock = (item) =>
    item.stock === -1 ? "∞" : Math.max(0, item.stock - (item.reservedStock || 0));

  return (
    <div className="admin-layout">
      <AdminSidebar />
      <main className="admin-main">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <p style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--red)", marginBottom: "0.25rem" }}>
              Admin Panel
            </p>
            <h2 className="section-title" style={{ margin: 0 }}>Inventory</h2>
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
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.length === 0 && (
                    <tr><td colSpan={7} style={{ textAlign: "center", padding: "2rem", color: "var(--charcoal-soft)" }}>No items</td></tr>
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
                      <td style={{ fontWeight: 600 }}>
                        {item.stock === -1 ? "∞ unlimited" : item.stock}
                      </td>
                      <td style={{ color: "var(--charcoal-soft)" }}>
                        {item.stock === -1 ? "—" : (item.reservedStock || 0)}
                      </td>
                      <td style={{ fontWeight: 700, color: isLow(item) ? "var(--amber)" : "var(--green)" }}>
                        {availableStock(item)}
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
                          <button className="btn-ghost"      onClick={() => openLogs(item)} style={{ fontSize: "0.78rem" }}>Logs</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Restock / Adjust Modal */}
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
                <input
                  type="text"
                  value={noteVal}
                  onChange={(e) => setNoteVal(e.target.value)}
                  placeholder="Reason for change"
                />
              </div>
              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "1.25rem" }}>
                <button className="btn-outline" onClick={() => setModal(null)}>Cancel</button>
                <button className="btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Audit Log Drawer */}
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
                      <th>Date</th>
                      <th>Reason</th>
                      <th>Delta</th>
                      <th>Before → After</th>
                      <th>By</th>
                      <th>Note</th>
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
      </main>
    </div>
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
