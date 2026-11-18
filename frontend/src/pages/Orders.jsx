import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import toast from "react-hot-toast";
import { getPizzaImage } from "../utils/pizzaImages";

const STATUSES = ["pending", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"];

const STATUS_LABEL = {
  pending:          "Order Received",
  confirmed:        "Confirmed",
  preparing:        "In Kitchen",
  out_for_delivery: "Out for Delivery",
  delivered:        "Delivered",
  cancelled:        "Cancelled",
};

const STATUS_EMOJI = {
  pending: "📋", confirmed: "✅", preparing: "👨🍳",
  out_for_delivery: "🛵", delivered: "🎉", cancelled: "❌",
};

// Summary cards: active = pending+confirmed+preparing+out_for_delivery
const SUMMARY_GROUPS = [
  { key: "active",    label: "Active",    statuses: ["pending", "confirmed", "preparing", "out_for_delivery"], color: "#3b82f6" },
  { key: "delivered", label: "Delivered", statuses: ["delivered"],  color: "var(--green)" },
  { key: "cancelled", label: "Cancelled", statuses: ["cancelled"],  color: "var(--red)" },
];

export default function Orders() {
  const [orders, setOrders]     = useState([]);
  const [filter, setFilter]     = useState("");
  const [page, setPage]         = useState(1);
  const [pages, setPages]       = useState(1);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(false);
  const [counts, setCounts]     = useState({}); // { pending: N, delivered: N, ... }
  const [countsLoading, setCountsLoading] = useState(true);

  // Fetch per-status counts once on mount for the summary bar
  useEffect(() => {
    Promise.all(
      STATUSES.map((s) =>
        api.get(`/orders?status=${s}&limit=1`).then(({ data }) => [s, data.total])
      )
    )
      .then((pairs) => setCounts(Object.fromEntries(pairs)))
      .catch(() => {})
      .finally(() => setCountsLoading(false));
  }, []);

  const fetchOrders = useCallback(() => {
    setLoading(true);
    setError(false);
    const params = new URLSearchParams({ page, limit: 10 });
    if (filter) params.set("status", filter);
    api.get(`/orders?${params}`)
      .then(({ data }) => {
        setOrders(data.orders);
        setPages(data.pages || 1);
        setTotal(data.total || 0);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [filter, page]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleCancel = async (orderId) => {
    if (!window.confirm("Cancel this order?")) return;
    try {
      const { data } = await api.put(`/orders/${orderId}/cancel`);
      setOrders((prev) => prev.map((o) => (o._id === orderId ? data.order : o)));
      // Refresh counts after cancellation
      setCounts((prev) => {
        const order = orders.find((o) => o._id === orderId);
        if (!order) return prev;
        return {
          ...prev,
          [order.status]: Math.max(0, (prev[order.status] || 0) - 1),
          cancelled: (prev.cancelled || 0) + 1,
        };
      });
      toast.success("Order cancelled");
    } catch (err) {
      toast.error(err.response?.data?.message || "Cannot cancel order");
    }
  };

  const totalOrders = Object.values(counts).reduce((a, b) => a + b, 0);

  if (loading && orders.length === 0) return (
    <div className="loading"><div className="spinner" /></div>
  );

  if (error) return (
    <div className="section empty-state">
      <span className="empty-state-icon">⚠️</span>
      <h2>Could not load orders</h2>
      <p>Please check your connection and try again.</p>
      <button className="btn-primary" onClick={fetchOrders}>Retry</button>
    </div>
  );

  return (
    <div className="section">
      {/* Page header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
        <div>
          <p className="section-eyebrow">Your history</p>
          <h2 className="section-title" style={{ marginBottom: 0 }}>
            My Orders
            {totalOrders > 0 && <span style={{ fontSize: "0.9rem", fontWeight: 500, color: "var(--charcoal-soft)", marginLeft: "0.75rem" }}>({totalOrders})</span>}
          </h2>
        </div>
        <Link to="/menu" className="btn-primary-sm">+ New Order</Link>
      </div>

      {/* Summary cards */}
      {!countsLoading && totalOrders > 0 && (
        <div className="stats-grid" style={{ marginBottom: "1.75rem" }}>
          <div className="stat-card" style={{ borderTopColor: "var(--charcoal-mid)" }}>
            <p className="stat-label">Total Orders</p>
            <p className="stat-value" style={{ fontSize: "1.6rem" }}>{totalOrders}</p>
          </div>
          {SUMMARY_GROUPS.map(({ key, label, statuses, color }) => {
            const count = statuses.reduce((sum, s) => sum + (counts[s] || 0), 0);
            return (
              <div key={key} className="stat-card" style={{ borderTopColor: color }}>
                <p className="stat-label">{label}</p>
                <p className="stat-value" style={{ fontSize: "1.6rem", color: count > 0 ? color : "inherit" }}>{count}</p>
                {count > 0 && (
                  <button
                    onClick={() => { setFilter(statuses[0]); setPage(1); }}
                    style={{ fontSize: "0.72rem", color, fontWeight: 600, marginTop: "0.4rem", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                  >
                    View →
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Status filter pills */}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1.75rem" }}>
        <button className={filter === "" ? "pill active" : "pill"} onClick={() => { setFilter(""); setPage(1); }}>
          All
        </button>
        {STATUSES.map((s) => (
          <button
            key={s}
            className={filter === s ? "pill active" : "pill"}
            onClick={() => { setFilter(s); setPage(1); }}
          >
            {STATUS_EMOJI[s]} {STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : orders.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-icon">📦</span>
          <h2>{filter ? `No ${STATUS_LABEL[filter] || filter} orders` : "No orders yet"}</h2>
          <p>
            {filter
              ? "Try a different filter or clear it to see all orders."
              : "Your order history will appear here once you place your first order."}
          </p>
          {filter ? (
            <button className="btn-outline" onClick={() => { setFilter(""); setPage(1); }}>Clear filter</button>
          ) : (
            <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
              <Link to="/menu" className="btn-primary">Order Now</Link>
              <Link to="/builder" className="btn-outline">Build Your Pizza</Link>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="orders-list">
            {orders.map((order) => (
              <div key={order._id} className="order-card">
                <div className="order-card-header">
                  <div>
                    <p className="order-num">#{order._id.slice(-8).toUpperCase()}</p>
                    <p className="order-date">
                      {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      {" · "}
                      {new Date(order.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      {" · "}
                      {order.items.length} item{order.items.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.35rem" }}>
                    <span className={`status-badge ${order.status}`}>
                      {STATUS_EMOJI[order.status]} {STATUS_LABEL[order.status]}
                    </span>
                    <span className={`status-badge ${order.payment.status}`} style={{ fontSize: "0.68rem" }}>
                      {order.payment.method.toUpperCase()} · {order.payment.status}
                    </span>
                  </div>
                </div>

                {/* Items summary */}
                <div className="order-card-items" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                  {order.items.map((item, i) => {
                    if (item.itemType === "custom") {
                      return (
                        <span key={i} style={{ fontSize: "0.85rem", color: "var(--charcoal-soft)" }}>
                          Custom Pizza ({item.size}) x {item.quantity}
                          {i < order.items.length - 1 ? ", " : ""}
                        </span>
                      );
                    }
                    const imageUrl = getPizzaImage(item);
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        <img
                          src={imageUrl}
                          alt={item.name}
                          className="order-item-img"
                          loading="lazy"
                          onError={(e) => { e.target.src = "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=800&q=80"; }}
                        />
                        <span style={{ fontSize: "0.85rem", color: "var(--charcoal-soft)" }}>
                          {item.name} ({item.size}) x {item.quantity}
                          {i < order.items.length - 1 ? ", " : ""}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Custom pizza selections inline */}
                {order.items.some((i) => i.itemType === "custom" && i.customPizza) && (
                  <div style={{ marginBottom: "0.75rem" }}>
                    {order.items
                      .filter((i) => i.itemType === "custom" && i.customPizza)
                      .map((item, i) => (
                        <div key={i} style={{ fontSize: "0.75rem", color: "var(--charcoal-soft)", padding: "0.4rem 0.75rem", background: "var(--cream)", borderRadius: "var(--r-sm)", marginBottom: "0.3rem" }}>
                          Base: {item.customPizza.baseName} · Sauce: {item.customPizza.sauceName} · Cheese: {item.customPizza.cheeseName}
                          {item.customPizza.veggieNames?.length > 0 && ` · Veggies: ${item.customPizza.veggieNames.join(", ")}`}
                        </div>
                      ))}
                  </div>
                )}

                <p style={{ fontSize: "0.78rem", color: "var(--charcoal-soft)", marginBottom: "0.85rem" }}>
                  {order.deliveryAddress.city}, {order.deliveryAddress.state}
                </p>

                <div className="order-card-footer">
                  <span className="order-total">₹{order.total}</span>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    {["pending", "confirmed"].includes(order.status) && (
                      <button
                        className="btn-ghost danger"
                        style={{ fontSize: "0.78rem" }}
                        onClick={() => handleCancel(order._id)}
                      >
                        Cancel
                      </button>
                    )}
                    <Link to={`/orders/${order._id}`} className="btn-outline-sm">
                      Track →
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {pages > 1 && (
            <div className="pagination" style={{ marginTop: "2rem" }}>
              <button className="btn-outline-sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                ← Prev
              </button>
              <span>Page {page} of {pages}</span>
              <button className="btn-outline-sm" onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages}>
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
