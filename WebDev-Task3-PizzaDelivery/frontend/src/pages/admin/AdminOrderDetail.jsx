import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import api from "../../api/axios";
import AdminLayout from "../../components/AdminLayout";
import toast from "react-hot-toast";
import { getPizzaImage } from "../../utils/pizzaImages";

const NEXT_STATUS = {
  pending:          "confirmed",
  confirmed:        "preparing",
  preparing:        "out_for_delivery",
  out_for_delivery: "delivered",
};

const NEXT_LABEL = {
  confirmed:        "Confirm Order",
  preparing:        "Send to Kitchen",
  out_for_delivery: "Send to Delivery",
  delivered:        "Mark Delivered",
};

const STATUS_LABEL = {
  pending:          "Order Received",
  confirmed:        "Confirmed",
  preparing:        "In Kitchen",
  out_for_delivery: "Out for Delivery",
  delivered:        "Delivered",
  cancelled:        "Cancelled",
};

function CustomPizzaDetail({ cp }) {
  if (!cp) return null;
  return (
    <div style={{ marginTop: "0.4rem", padding: "0.6rem 0.85rem", background: "var(--cream)", borderRadius: "var(--r-sm)", fontSize: "0.8rem", color: "var(--charcoal-mid)" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
        <span><strong>Base:</strong> {cp.baseName}</span>
        <span><strong>Sauce:</strong> {cp.sauceName}</span>
        <span><strong>Cheese:</strong> {cp.cheeseName}</span>
        {cp.veggieNames?.length > 0 && (
          <span><strong>Veggies:</strong> {cp.veggieNames.join(", ")}</span>
        )}
      </div>
    </div>
  );
}

export default function AdminOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder]       = useState(null);
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    api.get(`/orders/${id}`)
      .then(({ data }) => setOrder(data.order))
      .catch((err) => {
        if (err.response?.status === 404 || err.response?.status === 403) setNotFound(true);
        else toast.error("Failed to load order");
      })
      .finally(() => setLoading(false));
  }, [id]);

  const advance = async () => {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    setUpdating(true);
    try {
      const { data } = await api.put(`/orders/${order._id}/status`, { status: next });
      setOrder(data.order);
      toast.success(`Status updated: ${NEXT_LABEL[next]}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Update failed");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return (
    <AdminLayout pageTitle="Order Detail">
      <div className="loading"><div className="spinner" /></div>
    </AdminLayout>
  );

  if (notFound || !order) return (
    <AdminLayout pageTitle="Order Detail">
      <div className="empty-state">
        <span className="empty-state-icon">🔍</span>
        <h2>Order not found</h2>
        <p>This order does not exist or you do not have permission to view it.</p>
        <Link to="/admin/orders" className="btn-primary">Back to Orders</Link>
      </div>
    </AdminLayout>
  );

  const next = NEXT_STATUS[order.status];
  const isFinal = ["delivered", "cancelled"].includes(order.status);

  return (
    <AdminLayout pageTitle={`Order #${order._id.slice(-8).toUpperCase()}`}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <p style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--red)", marginBottom: "0.25rem" }}>
            Admin Panel / Orders
          </p>
          <h2 className="section-title" style={{ margin: 0 }}>
            Order #{order._id.slice(-8).toUpperCase()}
          </h2>
          <p style={{ fontSize: "0.82rem", color: "var(--charcoal-soft)", marginTop: "0.25rem" }}>
            {new Date(order.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button className="btn-outline" onClick={() => navigate(-1)}>Back</button>
          {!isFinal && next && (
            <button className="btn-primary" onClick={advance} disabled={updating}>
              {updating ? "Updating..." : `-> ${NEXT_LABEL[next]}`}
            </button>
          )}
        </div>
      </div>

      {/* Status + payment row */}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1.5rem", alignItems: "center" }}>
        <span className={`status-badge ${order.status}`} style={{ fontSize: "0.85rem", padding: "0.4rem 1rem" }}>
          {STATUS_LABEL[order.status] || order.status.replace(/_/g, " ")}
        </span>
        <span style={{ color: "var(--charcoal-soft)" }}>|</span>
        <span style={{ fontSize: "0.82rem", color: "var(--charcoal-soft)", textTransform: "uppercase", fontWeight: 600 }}>
          {order.payment.method}
        </span>
        <span className={`status-badge ${order.payment.status}`} style={{ fontSize: "0.85rem", padding: "0.4rem 1rem" }}>
          {order.payment.status}
        </span>
        {order.payment.status === "refunded" && (
          <span style={{ fontSize: "0.78rem", color: "var(--charcoal-soft)" }}>
            (Rs.{Math.round((order.payment.refundAmountP || 0) / 100)} refunded)
          </span>
        )}
        <span style={{ fontSize: "0.72rem", color: "var(--charcoal-soft)", marginLeft: "auto", fontStyle: "italic" }}>
          Payment status is managed by the payment system and cannot be changed manually.
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }} className="order-detail-grid">
        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div className="card">
            <h3>Customer</h3>
            <p style={{ fontWeight: 700, marginBottom: "0.2rem" }}>{order.user?.name}</p>
            <p style={{ fontSize: "0.85rem", color: "var(--charcoal-soft)" }}>{order.user?.email}</p>
            <p style={{ fontSize: "0.85rem", color: "var(--charcoal-soft)", marginTop: "0.75rem", lineHeight: 1.7 }}>
              {order.deliveryAddress.street}<br />
              {order.deliveryAddress.city}, {order.deliveryAddress.state}<br />
              {order.deliveryAddress.pincode}
            </p>
            {order.notes && (
              <p style={{ fontSize: "0.82rem", fontStyle: "italic", color: "var(--charcoal-soft)", marginTop: "0.75rem", padding: "0.6rem 0.85rem", background: "var(--cream)", borderRadius: "var(--r-sm)" }}>
                "{order.notes}"
              </p>
            )}
          </div>

          {order.statusHistory?.length > 0 && (
            <div className="card">
              <h3>Status History</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {order.statusHistory.map((h, i) => (
                  <div key={i} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                    <span className={`status-badge ${h.status}`} style={{ flexShrink: 0 }}>{STATUS_LABEL[h.status] || h.status.replace(/_/g, " ")}</span>
                    <span style={{ fontSize: "0.78rem", color: "var(--charcoal-soft)" }}>
                      {new Date(h.changedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      {h.note && ` — ${h.note}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="card">
          <h3>Items Ordered</h3>
          {order.items.map((item, i) => {
            const imageUrl = item.itemType === "menu" ? getPizzaImage(item) : null;
            return (
              <div key={i} style={{ paddingBottom: "0.85rem", marginBottom: "0.85rem", borderBottom: i < order.items.length - 1 ? "1px solid var(--cream-border)" : "none", display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                {imageUrl && (
                  <img
                    src={imageUrl}
                    alt={item.name}
                    className="order-item-img"
                    loading="lazy"
                    style={{ width: 60, height: 60, objectFit: "cover", borderRadius: "var(--r-sm)", flexShrink: 0 }}
                    onError={(e) => { e.target.src = "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=800&q=80"; }}
                  />
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <span style={{ fontWeight: 600 }}>
                        {item.itemType === "custom" ? "Custom Pizza" : item.name}
                      </span>
                      <span style={{ fontSize: "0.8rem", color: "var(--charcoal-soft)", marginLeft: "0.5rem" }}>
                        {item.size} x {item.quantity}
                      </span>
                      {item.itemType === "custom" && item.customPizza && (
                        <CustomPizzaDetail cp={item.customPizza} />
                      )}
                      {item.itemType === "menu" && item.toppings?.length > 0 && (
                        <p style={{ fontSize: "0.75rem", color: "var(--charcoal-soft)", marginTop: "0.25rem" }}>
                          Extra: {item.toppings.join(", ")}
                        </p>
                      )}
                    </div>
                    <span style={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                      Rs.{(item.price ?? Math.round(item.priceP / 100)) * item.quantity}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
          <hr />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", color: "var(--charcoal-soft)", marginBottom: "0.3rem" }}>
            <span>Subtotal</span><span>Rs.{order.subtotal}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", color: "var(--charcoal-soft)", marginBottom: "0.3rem" }}>
            <span>Delivery Fee</span><span>Rs.{order.deliveryFee}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: "1.05rem", marginTop: "0.5rem" }}>
            <span>Total</span><span>Rs.{order.total}</span>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
