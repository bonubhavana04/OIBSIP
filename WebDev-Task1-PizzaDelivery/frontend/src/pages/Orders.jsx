import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import toast from "react-hot-toast";

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.get("/orders")
      .then(({ data }) => { setOrders(data.orders); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  const handleCancel = async (orderId) => {
    if (!window.confirm("Cancel this order?")) return;
    try {
      const { data } = await api.put(`/orders/${orderId}/cancel`);
      setOrders((prev) => prev.map((o) => (o._id === orderId ? data.order : o)));
      toast.success("Order cancelled");
    } catch (err) {
      toast.error(err.response?.data?.message || "Cannot cancel order");
    }
  };

  if (loading) return (
    <div className="loading"><div className="spinner" /></div>
  );

  if (error) return (
    <div className="section empty-state">
      <span className="empty-state-icon">⚠️</span>
      <h2>Could not load orders</h2>
      <p>Please check your connection and try again.</p>
      <button className="btn-primary" onClick={() => window.location.reload()}>Retry</button>
    </div>
  );

  if (orders.length === 0) return (
    <div className="section empty-state">
      <span className="empty-state-icon">📦</span>
      <h2>No orders yet</h2>
      <p>Your order history will appear here once you place your first order.</p>
      <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
        <Link to="/menu" className="btn-primary">Order Now</Link>
        <Link to="/builder" className="btn-outline">Build Your Pizza</Link>
      </div>
    </div>
  );

  return (
    <div className="section">
      <p className="section-eyebrow">Your history</p>
      <h2 className="section-title">My Orders</h2>

      <div className="orders-list">
        {orders.map((order) => (
          <div key={order._id} className="order-card">
            <div className="order-card-header">
              <div>
                <p className="order-num">#{order._id.slice(-8).toUpperCase()}</p>
                <p className="order-date">
                  {new Date(order.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric", month: "short", year: "numeric",
                  })} · {order.items.length} item{order.items.length !== 1 ? "s" : ""}
                </p>
              </div>
              <span className={`status-badge ${order.status}`}>
                {order.status.replace(/_/g, " ")}
              </span>
            </div>

            <p className="order-card-items">
              {order.items.map((item, i) => (
                <span key={i}>
                  {item.name} ({item.size}) × {item.quantity}
                  {i < order.items.length - 1 ? ", " : ""}
                </span>
              ))}
            </p>

            <div className="order-card-footer">
              <div>
                <span className="order-total">₹{order.total}</span>
                <span style={{ fontSize: "0.75rem", color: "var(--charcoal-soft)", marginLeft: "0.5rem" }}>
                  via {order.payment.method.toUpperCase()}
                </span>
              </div>
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
    </div>
  );
}
