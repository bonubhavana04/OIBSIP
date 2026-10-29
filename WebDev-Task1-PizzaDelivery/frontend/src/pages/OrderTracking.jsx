import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { io } from "socket.io-client";
import api from "../api/axios";
import toast from "react-hot-toast";

const STEPS = ["pending", "confirmed", "preparing", "out_for_delivery", "delivered"];

const STEP_META = {
  pending:          { label: "Order Placed",      emoji: "📋" },
  confirmed:        { label: "Confirmed",          emoji: "✅" },
  preparing:        { label: "Being Prepared",     emoji: "👨‍🍳" },
  out_for_delivery: { label: "Out for Delivery",   emoji: "🛵" },
  delivered:        { label: "Delivered",          emoji: "🎉" },
  cancelled:        { label: "Cancelled",          emoji: "❌" },
};

export default function OrderTracking() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/orders/${id}`)
      .then(({ data }) => { setOrder(data.order); setLoading(false); })
      .catch(() => setLoading(false));

    // In dev, Vite proxies /socket.io → backend. In prod, connect to the API origin.
    const socketUrl = import.meta.env.VITE_API_URL
      ? import.meta.env.VITE_API_URL.replace(/\/api.*$/, "")
      : undefined; // undefined = same origin (Vite proxy handles it)
    const socket = io(socketUrl, { path: "/socket.io" });
    socket.emit("join_order", id);
    socket.on("order_status_update", ({ status }) => {
      setOrder((prev) => prev ? { ...prev, status } : prev);
      toast(`Order status: ${status.replace(/_/g, " ")}`, { icon: "📦" });
    });
    return () => socket.disconnect();
  }, [id]);

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

  if (loading) return <div className="loading"><div className="spinner" /></div>;
  if (!order) return (
    <div className="section empty-state">
      <span className="empty-state-icon">🔍</span>
      <h2>Order not found</h2>
      <Link to="/orders" className="btn-primary">My Orders</Link>
    </div>
  );

  const stepIndex = STEPS.indexOf(order.status);
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
          {["pending", "confirmed"].includes(order.status) && (
            <button className="btn-ghost danger" onClick={handleCancel}>Cancel Order</button>
          )}
          <Link to="/orders" className="btn-outline-sm">← All Orders</Link>
        </div>
      </div>

      <p className="order-id-label">
        Order <code>{order._id}</code> ·{" "}
        {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
      </p>

      {/* Status stepper */}
      {isCancelled ? (
        <div style={{
          background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "var(--r-lg)",
          padding: "2rem", textAlign: "center", margin: "2rem 0",
        }}>
          <span style={{ fontSize: "3rem", display: "block", marginBottom: "0.75rem" }}>❌</span>
          <p style={{ fontWeight: 700, color: "#b91c1c", fontSize: "1.1rem" }}>Order Cancelled</p>
          <p style={{ color: "#991b1b", fontSize: "0.88rem", marginTop: "0.25rem" }}>
            This order has been cancelled.
          </p>
        </div>
      ) : (
        <div className="stepper">
          {STEPS.map((step, i) => {
            const done = i < stepIndex || isDelivered;
            const active = i === stepIndex;
            const meta = STEP_META[step];
            return (
              <div key={step} className={`step ${done ? "done" : ""} ${active ? "active" : ""}`}>
                <div className="step-dot">
                  {done ? "✓" : meta.emoji}
                </div>
                <p className="step-label">{meta.label}</p>
                {i < STEPS.length - 1 && (
                  <div className={`step-line ${done ? "done" : ""}`} />
                )}
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

      {/* Details grid */}
      <div className="order-details-grid">
        <div className="card">
          <h3>Items Ordered</h3>
          {order.items.map((item, i) => (
            <div key={i} className="summary-row">
              <span>{item.name} ({item.size}) × {item.quantity}</span>
              <span>₹{(item.price ?? Math.round(item.priceP / 100)) * item.quantity}</span>
            </div>
          ))}
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

          <h3 style={{ marginTop: "1.25rem" }}>Payment</h3>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "var(--charcoal-mid)", fontSize: "0.9rem" }}>
              {order.payment.method.toUpperCase()}
            </span>
            <span className={`status-badge ${order.payment.status}`}>
              {order.payment.status}
            </span>
          </div>

          {order.notes && (
            <>
              <h3 style={{ marginTop: "1.25rem" }}>Special Instructions</h3>
              <p style={{ color: "var(--charcoal-soft)", fontSize: "0.88rem", fontStyle: "italic" }}>
                "{order.notes}"
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
