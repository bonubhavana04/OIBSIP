import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { io } from "socket.io-client";
import api from "../api/axios";
import toast from "react-hot-toast";
import { getPizzaImage } from "../utils/pizzaImages";

// Fulfilment steps shown in the progress indicator
const STEPS = ["pending", "confirmed", "preparing", "out_for_delivery", "delivered"];

const STEP_META = {
  pending:          { label: "Order Received",    emoji: "📋" },
  confirmed:        { label: "Confirmed",          emoji: "✅" },
  preparing:        { label: "In Kitchen",         emoji: "👨‍🍳" },
  out_for_delivery: { label: "Sent to Delivery",   emoji: "🛵" },
  delivered:        { label: "Delivered",          emoji: "🎉" },
  cancelled:        { label: "Cancelled",          emoji: "❌" },
};

// How often to poll as a fallback (ms). Polling only runs when the socket is
// disconnected so it doesn't duplicate real-time updates.
const POLL_INTERVAL_MS = 15_000;

function CustomPizzaDetail({ cp }) {
  if (!cp) return null;
  return (
    <div style={{ marginTop: "0.4rem", padding: "0.6rem 0.85rem", background: "var(--cream)", borderRadius: "var(--r-sm)", fontSize: "0.8rem", color: "var(--charcoal-mid)" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        <span>🫓 <strong>Base:</strong> {cp.baseName}</span>
        <span>🍅 <strong>Sauce:</strong> {cp.sauceName}</span>
        <span>🧀 <strong>Cheese:</strong> {cp.cheeseName}</span>
        {cp.veggieNames?.length > 0 && (
          <span>🥦 <strong>Veggies:</strong> {cp.veggieNames.join(", ")}</span>
        )}
      </div>
    </div>
  );
}

export default function OrderTracking() {
  const { id } = useParams();
  const [order, setOrder]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [socketOk, setSocketOk] = useState(false); // true while socket is connected

  const socketRef  = useRef(null);
  const pollRef    = useRef(null);

  // ── Fetch order from REST (used on mount, reconnect, and poll) ──────────────
  const fetchOrder = useCallback(() => {
    return api.get(`/orders/${id}`)
      .then(({ data }) => {
        setOrder(data.order);
        setLoading(false);
      })
      .catch((err) => {
        setLoading(false);
        if (err.response?.status === 403 || err.response?.status === 404)
          setNotFound(true);
      });
  }, [id]);

  // ── Polling fallback — only active while socket is disconnected ─────────────
  const startPoll = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(fetchOrder, POLL_INTERVAL_MS);
  }, [fetchOrder]);

  const stopPoll = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  // ── Socket.IO setup ─────────────────────────────────────────────────────────
  useEffect(() => {
    fetchOrder(); // initial REST fetch — always authoritative on load / refresh

    const token = localStorage.getItem("token");
    const socketUrl = import.meta.env.VITE_API_URL
      ? import.meta.env.VITE_API_URL.replace(/\/api.*$/, "")
      : undefined; // undefined → same origin (Vite proxy)

    const socket = io(socketUrl, {
      path: "/socket.io",
      auth: { token },           // JWT sent at handshake — server validates it
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setSocketOk(true);
      stopPoll();
      // Re-join the room and re-fetch to catch any updates missed while offline
      socket.emit("join_order", id);
      fetchOrder();
    });

    socket.on("connect_error", () => {
      setSocketOk(false);
      startPoll(); // fall back to polling when socket can't connect
    });

    socket.on("disconnect", () => {
      setSocketOk(false);
      startPoll(); // fall back to polling on unexpected disconnect
    });

    // Server emits this after persisting the status change in MongoDB
    socket.on("order_status_update", ({ orderId, status }) => {
      if (orderId?.toString() !== id) return; // guard: ignore other orders
      setOrder((prev) => prev ? { ...prev, status } : prev);
      toast(`Status: ${STEP_META[status]?.label ?? status}`, { icon: "📦" });
    });

    return () => {
      socket.disconnect();
      stopPoll();
    };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cancel handler ──────────────────────────────────────────────────────────
  const handleCancel = async () => {
    if (!window.confirm("Cancel this order?")) return;
    try {
      const { data } = await api.put(`/orders/${id}/cancel`);
      setOrder(data.order);
      toast.success("Order cancelled");
    } catch (err) {
      toast.error(err.response?.data?.message || "Cannot cancel at this stage");
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loading) return <div className="loading"><div className="spinner" /></div>;

  if (notFound || !order) return (
    <div className="section empty-state">
      <span className="empty-state-icon">🔍</span>
      <h2>Order not found</h2>
      <p>This order doesn't exist or you don't have permission to view it.</p>
      <Link to="/orders" className="btn-primary">My Orders</Link>
    </div>
  );

  const stepIndex   = STEPS.indexOf(order.status);
  const isCancelled = order.status === "cancelled";
  const isDelivered = order.status === "delivered";

  return (
    <div className="section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "0.5rem" }}>
        <div>
          <p className="section-eyebrow">Live tracking</p>
          <h2 className="section-title" style={{ marginBottom: "0.25rem" }}>Order Tracking</h2>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          {/* Real-time indicator */}
          <span style={{ fontSize: "0.72rem", color: socketOk ? "var(--green)" : "var(--charcoal-soft)", display: "flex", alignItems: "center", gap: "0.3rem" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: socketOk ? "var(--green)" : "#9ca3af", display: "inline-block" }} />
            {socketOk ? "Live" : "Polling"}
          </span>
          {["pending", "confirmed"].includes(order.status) && (
            <button className="btn-ghost danger" onClick={handleCancel}>Cancel Order</button>
          )}
          <Link to="/orders" className="btn-outline-sm">← All Orders</Link>
        </div>
      </div>

      <p className="order-id-label">
        Order <code>{order._id}</code>
        {" · "}
        {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
        {" · "}
        {new Date(order.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
      </p>

      {/* ── Fulfilment progress stepper ── */}
      {isCancelled ? (
        <div style={{
          background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "var(--r-lg)",
          padding: "2rem", textAlign: "center", margin: "2rem 0",
        }}>
          <span style={{ fontSize: "3rem", display: "block", marginBottom: "0.75rem" }}>❌</span>
          <p style={{ fontWeight: 700, color: "#b91c1c", fontSize: "1.1rem" }}>Order Cancelled</p>
          {order.payment.status === "refunded" && (
            <p style={{ color: "#991b1b", fontSize: "0.88rem", marginTop: "0.4rem" }}>
              Refund of ₹{Math.round((order.payment.refundAmountP || 0) / 100)} has been processed.
            </p>
          )}
        </div>
      ) : (
        <div className="stepper">
          {STEPS.map((step, i) => {
            const done   = i < stepIndex || isDelivered;
            const active = i === stepIndex;
            const meta   = STEP_META[step];
            return (
              <div key={step} className={`step ${done ? "done" : ""} ${active ? "active" : ""}`}>
                <div className="step-dot">{done ? "✓" : meta.emoji}</div>
                <p className="step-label">{meta.label}</p>
                {i < STEPS.length - 1 && <div className={`step-line ${done ? "done" : ""}`} />}
              </div>
            );
          })}
        </div>
      )}

      {/* Estimated delivery */}
      {!isCancelled && !isDelivered && order.estimatedDelivery && (
        <div style={{
          background: "var(--green-light)", border: "1px solid #a7f3d0", borderRadius: "var(--r-sm)",
          padding: "0.75rem 1.25rem", marginBottom: "1.5rem", fontSize: "0.88rem", color: "var(--green)",
          display: "flex", alignItems: "center", gap: "0.5rem",
        }}>
          🕐 Estimated delivery by{" "}
          <strong>
            {new Date(order.estimatedDelivery).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
          </strong>
        </div>
      )}

      {/* ── Details grid ── */}
      <div className="order-details-grid">
        <div className="card">
          <h3>Items Ordered</h3>
          {order.items.map((item, i) => {
            const imageUrl = item.itemType === "menu" ? getPizzaImage(item) : null;
            return (
              <div key={i} style={{ marginBottom: "1rem", display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                {imageUrl && (
                  <img
                    src={imageUrl}
                    alt={item.name}
                    className="order-item-img"
                    loading="lazy"
                    style={{ width: 70, height: 70, objectFit: "cover", borderRadius: "var(--r-sm)", flexShrink: 0 }}
                    onError={(e) => { e.target.src = "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=800&q=80"; }}
                  />
                )}
                <div style={{ minWidth: 0 }}>
                  <div className="summary-row" style={{ alignItems: "flex-start" }}>
                    <span style={{ fontWeight: 600 }}>
                      {item.itemType === "custom" ? "🍕 Custom Pizza" : item.name}
                      <span style={{ fontWeight: 400, color: "var(--charcoal-soft)", marginLeft: "0.4rem" }}>
                        ({item.size}) × {item.quantity}
                      </span>
                    </span>
                    <span>₹{(item.price ?? Math.round(item.priceP / 100)) * item.quantity}</span>
                  </div>
                  {item.itemType === "custom" && item.customPizza && (
                    <CustomPizzaDetail cp={item.customPizza} />
                  )}
                  {item.itemType === "menu" && item.toppings?.length > 0 && (
                    <p style={{ fontSize: "0.75rem", color: "var(--charcoal-soft)", marginTop: "0.25rem" }}>
                      Extra toppings: {item.toppings.join(", ")}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
          <hr />
          <div className="summary-row"><span>Subtotal</span><span>₹{order.subtotal}</span></div>
          <div className="summary-row"><span>Delivery Fee</span><span>₹{order.deliveryFee}</span></div>
          <div className="summary-row total"><span>Total</span><span>₹{order.total}</span></div>
        </div>

        <div className="card">
          <h3>Delivery Address</h3>
          <p style={{ lineHeight: 1.8, color: "var(--charcoal-mid)" }}>
            {order.deliveryAddress.street}<br />
            {order.deliveryAddress.city}, {order.deliveryAddress.state}<br />
            {order.deliveryAddress.pincode}
          </p>

          {/* Payment status — kept visually separate from fulfilment status */}
          <h3 style={{ marginTop: "1.25rem" }}>Payment</h3>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span style={{ color: "var(--charcoal-mid)", fontSize: "0.9rem" }}>
              {order.payment.method.toUpperCase()}
            </span>
            <span className={`status-badge ${order.payment.status}`}>
              {order.payment.status}
            </span>
          </div>
          {order.payment.paidAt && (
            <p style={{ fontSize: "0.78rem", color: "var(--charcoal-soft)" }}>
              Paid at {new Date(order.payment.paidAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
          {order.payment.refundStatus && order.payment.refundStatus !== "none" && (
            <div style={{ marginTop: "0.75rem", padding: "0.6rem 0.85rem", background: "var(--amber-light)", borderRadius: "var(--r-sm)", fontSize: "0.8rem", color: "var(--amber)" }}>
              Refund: {order.payment.refundStatus}
              {order.payment.refundAmountP > 0 && ` · ₹${Math.round(order.payment.refundAmountP / 100)}`}
            </div>
          )}

          {order.notes && (
            <>
              <h3 style={{ marginTop: "1.25rem" }}>Special Instructions</h3>
              <p style={{ color: "var(--charcoal-soft)", fontSize: "0.88rem", fontStyle: "italic" }}>
                "{order.notes}"
              </p>
            </>
          )}

          {/* Status history */}
          {order.statusHistory?.length > 0 && (
            <>
              <h3 style={{ marginTop: "1.25rem" }}>Status History</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                {order.statusHistory.map((h, i) => (
                  <div key={i} style={{ display: "flex", gap: "0.6rem", alignItems: "center", fontSize: "0.78rem" }}>
                    <span className={`status-badge ${h.status}`} style={{ fontSize: "0.68rem" }}>
                      {STEP_META[h.status]?.label ?? h.status.replace(/_/g, " ")}
                    </span>
                    <span style={{ color: "var(--charcoal-soft)" }}>
                      {new Date(h.changedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
