import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../api/axios";
import AdminLayout from "../../components/AdminLayout";
import toast from "react-hot-toast";
import { getPizzaImage } from "../../utils/pizzaImages";

const STATUSES = ["pending", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"];

// Single valid next step per status — mirrors backend allowedTransitions
const NEXT_STATUS = {
  pending:          "confirmed",
  confirmed:        "preparing",
  preparing:        "out_for_delivery",
  out_for_delivery: "delivered",
};

// Button labels describe the ACTION being taken (keyed by the resulting status)
const NEXT_LABEL = {
  confirmed:        "Confirm Order",
  preparing:        "Send to Kitchen",
  out_for_delivery: "Send to Delivery",
  delivered:        "Mark Delivered",
};

// Human-readable current status labels for display
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
    <div style={{ fontSize: "0.78rem", color: "var(--charcoal-soft)", marginTop: "0.25rem" }}>
      <span>Base: {cp.baseName}</span>
      {" · "}
      <span>Sauce: {cp.sauceName}</span>
      {" · "}
      <span>Cheese: {cp.cheeseName}</span>
      {cp.veggieNames?.length > 0 && (
        <span> · Veggies: {cp.veggieNames.join(", ")}</span>
      )}
    </div>
  );
}

function OrderDetailModal({ order, onClose, onStatusUpdate }) {
  const [updating, setUpdating] = useState(false);
  const next = NEXT_STATUS[order.status];

  const advance = async () => {
    if (!next) return;
    setUpdating(true);
    try {
      const { data } = await api.put(`/orders/${order._id}/status`, { status: next });
      onStatusUpdate(data.order);
      toast.success(`Status updated: ${NEXT_LABEL[next] || next.replace(/_/g, " ")}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Update failed");
    } finally {
      setUpdating(false);
    }
  };

  const isFinal = ["delivered", "cancelled"].includes(order.status);

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div
        style={{ ...modalStyle, width: "min(680px, 95vw)", maxHeight: "85vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem" }}>
          <div>
            <p style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--red)", marginBottom: "0.2rem" }}>
              Order Detail
            </p>
            <h3 style={{ margin: 0 }}>#{order._id.slice(-8).toUpperCase()}</h3>
            <p style={{ fontSize: "0.78rem", color: "var(--charcoal-soft)", marginTop: "0.2rem" }}>
              {new Date(order.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
          <button className="btn-ghost" onClick={onClose}>X</button>
        </div>

        {/* Status + payment — payment is read-only */}
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1.25rem", alignItems: "center" }}>
          <span className={`status-badge ${order.status}`}>{STATUS_LABEL[order.status] || order.status.replace(/_/g, " ")}</span>
          <span style={{ color: "var(--charcoal-soft)", fontSize: "0.8rem" }}>|</span>
          <span style={{ fontSize: "0.8rem", color: "var(--charcoal-soft)", textTransform: "uppercase", fontWeight: 600 }}>
            {order.payment.method}
          </span>
          <span className={`status-badge ${order.payment.status}`}>{order.payment.status}</span>
          {order.payment.status === "refunded" && (
            <span style={{ fontSize: "0.75rem", color: "var(--charcoal-soft)" }}>
              (Rs.{Math.round((order.payment.refundAmountP || 0) / 100)} refunded)
            </span>
          )}
        </div>

        {/* Customer */}
        <div className="card" style={{ padding: "1rem", marginBottom: "1rem" }}>
          <p style={{ fontWeight: 700, marginBottom: "0.2rem" }}>{order.user?.name}</p>
          <p style={{ fontSize: "0.82rem", color: "var(--charcoal-soft)" }}>{order.user?.email}</p>
          <p style={{ fontSize: "0.82rem", color: "var(--charcoal-soft)", marginTop: "0.5rem" }}>
            {order.deliveryAddress.street}, {order.deliveryAddress.city}, {order.deliveryAddress.state} — {order.deliveryAddress.pincode}
          </p>
          {order.notes && (
            <p style={{ fontSize: "0.82rem", fontStyle: "italic", color: "var(--charcoal-soft)", marginTop: "0.5rem" }}>
              Note: "{order.notes}"
            </p>
          )}
        </div>

        {/* Items */}
        <div className="card" style={{ padding: "1rem", marginBottom: "1rem" }}>
          <h4 style={{ marginBottom: "0.75rem", fontSize: "0.88rem" }}>Items Ordered</h4>
          {order.items.map((item, i) => (
            <div key={i} style={{ paddingBottom: "0.75rem", marginBottom: "0.75rem", borderBottom: i < order.items.length - 1 ? "1px solid var(--cream-border)" : "none" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: "0.88rem" }}>
                    {item.itemType === "custom" ? "Custom Pizza" : item.name}
                  </span>
                  <span style={{ fontSize: "0.78rem", color: "var(--charcoal-soft)", marginLeft: "0.5rem" }}>
                    {item.size} x {item.quantity}
                  </span>
                  {item.itemType === "custom" && item.customPizza && (
                    <CustomPizzaDetail cp={item.customPizza} />
                  )}
                  {item.itemType === "menu" && item.toppings?.length > 0 && (
                    <p style={{ fontSize: "0.75rem", color: "var(--charcoal-soft)", marginTop: "0.2rem" }}>
                      Extra: {item.toppings.join(", ")}
                    </p>
                  )}
                </div>
                <span style={{ fontWeight: 700, fontSize: "0.88rem", whiteSpace: "nowrap" }}>
                  Rs.{(item.price ?? Math.round(item.priceP / 100)) * item.quantity}
                </span>
              </div>
            </div>
          ))}
          <div style={{ borderTop: "1.5px solid var(--cream-border)", paddingTop: "0.75rem", marginTop: "0.25rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", color: "var(--charcoal-soft)", marginBottom: "0.3rem" }}>
              <span>Subtotal</span><span>Rs.{order.subtotal}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", color: "var(--charcoal-soft)", marginBottom: "0.3rem" }}>
              <span>Delivery Fee</span><span>Rs.{order.deliveryFee}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: "1rem" }}>
              <span>Total</span><span>Rs.{order.total}</span>
            </div>
          </div>
        </div>

        {/* Status history */}
        {order.statusHistory?.length > 0 && (
          <div className="card" style={{ padding: "1rem", marginBottom: "1rem" }}>
            <h4 style={{ marginBottom: "0.75rem", fontSize: "0.88rem" }}>Status History</h4>
            {order.statusHistory.map((h, i) => (
              <div key={i} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                <span className={`status-badge ${h.status}`} style={{ flexShrink: 0 }}>{STATUS_LABEL[h.status] || h.status.replace(/_/g, " ")}</span>
                <span style={{ fontSize: "0.75rem", color: "var(--charcoal-soft)" }}>
                  {new Date(h.changedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  {h.note && ` — ${h.note}`}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Actions — payment status is never editable here */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
          <button className="btn-outline" onClick={onClose}>Close</button>
          {!isFinal && next && (
            <button className="btn-primary" onClick={advance} disabled={updating}>
              {updating ? "Updating..." : `-> ${NEXT_LABEL[next]}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ManageOrders() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders]     = useState([]);
  const [filter, setFilter]     = useState(searchParams.get("status") || "");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo]     = useState("");
  const [page, setPage]         = useState(1);
  const [pages, setPages]       = useState(1);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState(null);

  const fetchOrders = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit: 15 });
    if (filter)   params.set("status", filter);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo)   params.set("dateTo", dateTo);
    api.get(`/orders?${params}`)
      .then(({ data }) => {
        setOrders(data.orders);
        setPages(data.pages);
        setTotal(data.total);
      })
      .catch(() => toast.error("Failed to load orders"))
      .finally(() => setLoading(false));
  }, [filter, dateFrom, dateTo, page]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Sync status filter from URL query param (e.g. dashboard shortcut links)
  useEffect(() => {
    const s = searchParams.get("status");
    if (s && s !== filter) setFilter(s);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilterChange = (val) => {
    setFilter(val);
    setPage(1);
    if (val) setSearchParams({ status: val });
    else setSearchParams({});
  };

  const advanceStatus = async (orderId, nextStatus) => {
    try {
      const { data } = await api.put(`/orders/${orderId}/status`, { status: nextStatus });
      setOrders((prev) => prev.map((o) => (o._id === orderId ? data.order : o)));
      if (selected?._id === orderId) setSelected(data.order);
      toast.success(`Status updated: ${NEXT_LABEL[nextStatus] || nextStatus.replace(/_/g, " ")}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Update failed");
    }
  };

  const openDetail = async (order) => {
    try {
      const { data } = await api.get(`/orders/${order._id}`);
      setSelected(data.order);
    } catch {
      setSelected(order);
    }
  };

  return (
    <AdminLayout pageTitle="Manage Orders">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <p style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--red)", marginBottom: "0.25rem" }}>
              Admin Panel
            </p>
            <h2 className="section-title" style={{ margin: 0 }}>
              Manage Orders
              {total > 0 && <span style={{ fontSize: "0.9rem", fontWeight: 500, color: "var(--charcoal-soft)", marginLeft: "0.75rem" }}>({total} total)</span>}
            </h2>
          </div>
        </div>

        {/* Filters */}
        <div style={{ marginBottom: "1.5rem", display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--charcoal-mid)", marginBottom: "0.3rem" }}>Status</label>
            <select className="select" value={filter} onChange={(e) => handleFilterChange(e.target.value)}>
              <option value="">All Statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--charcoal-mid)", marginBottom: "0.3rem" }}>From</label>
            <input type="date" className="select" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--charcoal-mid)", marginBottom: "0.3rem" }}>To</label>
            <input type="date" className="select" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
          </div>
          <button className="btn-ghost" onClick={() => { setFilter(""); setDateFrom(""); setDateTo(""); setPage(1); setSearchParams({}); }}>
            Clear
          </button>
          <button className="btn-ghost" onClick={fetchOrders}>Refresh</button>
        </div>

        {loading ? (
          <div className="loading"><div className="spinner" /></div>
        ) : orders.length === 0 ? (
          <div className="empty-state" style={{ padding: "3rem" }}>
            <span className="empty-state-icon">📦</span>
            <h2>No orders found</h2>
            <p>{filter ? `No orders with status "${filter.replace(/_/g, " ")}".` : "No orders have been placed yet."}</p>
            {filter && <button className="btn-outline" onClick={() => handleFilterChange("")}>Clear filter</button>}
          </div>
        ) : (
          <>
            <div className="table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Customer</th>
                    <th>Items</th>
                    <th>Total</th>
                    <th>Payment</th>
                    <th>Order Status</th>
                    <th>Created</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => {
                    const next = NEXT_STATUS[o.status];
                    return (
                      <tr key={o._id}>
                        <td style={{ fontFamily: "monospace", fontSize: "0.82rem" }}>
                          #{o._id.slice(-8).toUpperCase()}
                        </td>
                        <td>
                          <p style={{ fontWeight: 600, fontSize: "0.88rem" }}>{o.user?.name}</p>
                          <p style={{ fontSize: "0.75rem", color: "var(--charcoal-soft)" }}>{o.user?.email}</p>
                        </td>
                        <td>
                          <p>{o.items.length} item{o.items.length !== 1 ? "s" : ""}</p>
                          <p style={{ fontSize: "0.75rem", color: "var(--charcoal-soft)" }}>
                            {o.items.slice(0, 2).map((i) => i.itemType === "custom" ? "Custom Pizza" : i.name).join(", ")}
                            {o.items.length > 2 ? "..." : ""}
                          </p>
                        </td>
                        <td style={{ fontSize: "0.75rem", color: "var(--charcoal-soft)" }}>
                          {o.items.slice(0, 2).map((i) => i.itemType === "menu" ? getPizzaImage(i) : null).filter(Boolean).map((url, idx) => (
                            <img key={idx} src={url} alt="" style={{ width: 24, height: 24, objectFit: "cover", borderRadius: "4px", marginRight: "4px" }} onError={(e) => { e.target.src = "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=800&q=80"; }} />
                          ))}
                        </td>
                        <td style={{ fontWeight: 700 }}>Rs.{o.total}</td>
                        <td>
                          <p style={{ fontSize: "0.78rem", textTransform: "uppercase", color: "var(--charcoal-soft)", marginBottom: "0.2rem" }}>
                            {o.payment.method}
                          </p>
                          <span className={`status-badge ${o.payment.status}`}>{o.payment.status}</span>
                        </td>
                        <td>
                          <span className={`status-badge ${o.status}`}>
                            {STATUS_LABEL[o.status] || o.status.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td style={{ fontSize: "0.82rem", color: "var(--charcoal-soft)", whiteSpace: "nowrap" }}>
                          {new Date(o.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}
                          <br />
                          <span style={{ fontSize: "0.75rem" }}>
                            {new Date(o.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                            <button className="btn-outline-sm" onClick={() => openDetail(o)}>View</button>
                            {next && (
                              <button
                                className="btn-primary-sm"
                                style={{ fontSize: "0.75rem" }}
                                onClick={() => advanceStatus(o._id, next)}
                              >
                                {NEXT_LABEL[next]}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {pages > 1 && (
              <div className="pagination">
                <button className="btn-outline-sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                  Prev
                </button>
                <span>Page {page} of {pages}</span>
                <button className="btn-outline-sm" onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages}>
                  Next
                </button>
              </div>
            )}
          </>
        )}

        {selected && (
          <OrderDetailModal
            order={selected}
            onClose={() => setSelected(null)}
            onStatusUpdate={(updated) => {
              setOrders((prev) => prev.map((o) => (o._id === updated._id ? updated : o)));
              setSelected(updated);
            }}
          />
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
  padding: "2rem", boxShadow: "var(--shadow-xl)",
};
