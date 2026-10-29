import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import AdminSidebar from "../../components/AdminSidebar";
import toast from "react-hot-toast";

const STATUSES = ["pending", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"];

export default function ManageOrders() {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchOrders = () => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit: 10 });
    if (filter) params.set("status", filter);
    api.get(`/orders?${params}`)
      .then(({ data }) => {
        setOrders(data.orders);
        setPages(data.pages);
        setTotal(data.total);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchOrders(); }, [filter, page]);

  const updateStatus = async (orderId, status) => {
    try {
      const { data } = await api.put(`/orders/${orderId}/status`, { status });
      setOrders((prev) => prev.map((o) => (o._id === orderId ? data.order : o)));
      toast.success(`Status → ${status.replace(/_/g, " ")}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Update failed");
    }
  };

  return (
    <div className="admin-layout">
      <AdminSidebar />
      <main className="admin-main">
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

        {/* Filter */}
        <div style={{ marginBottom: "1.5rem", display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
          <select
            className="select"
            value={filter}
            onChange={(e) => { setFilter(e.target.value); setPage(1); }}
          >
            <option value="">All Statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
            ))}
          </select>
          <button className="btn-ghost" onClick={fetchOrders}>↻ Refresh</button>
        </div>

        {loading ? (
          <div className="loading"><div className="spinner" /></div>
        ) : orders.length === 0 ? (
          <div className="empty-state" style={{ padding: "3rem" }}>
            <span className="empty-state-icon">📦</span>
            <h2>No orders found</h2>
            <p>Try a different status filter.</p>
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
                    <th>Status</th>
                    <th>Update Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
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
                          {o.items.slice(0, 2).map((i) => i.name).join(", ")}
                          {o.items.length > 2 ? `…` : ""}
                        </p>
                      </td>
                      <td style={{ fontWeight: 700 }}>₹{o.total}</td>
                      <td>
                        <p style={{ fontSize: "0.82rem", textTransform: "uppercase" }}>{o.payment.method}</p>
                        <span className={`status-badge ${o.payment.status}`}>{o.payment.status}</span>
                      </td>
                      <td>
                        <span className={`status-badge ${o.status}`}>
                          {o.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td>
                        {!["delivered", "cancelled"].includes(o.status) ? (
                          <select
                            className="select"
                            style={{ fontSize: "0.78rem", padding: "4px 8px" }}
                            value={o.status}
                            onChange={(e) => updateStatus(o._id, e.target.value)}
                          >
                            {STATUSES.filter((s) => s !== "cancelled").map((s) => (
                              <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                            ))}
                          </select>
                        ) : (
                          <span style={{ fontSize: "0.78rem", color: "var(--charcoal-soft)" }}>—</span>
                        )}
                      </td>
                      <td>
                        <Link to={`/orders/${o._id}`} className="btn-outline-sm">View</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pagination">
              <button
                className="btn-outline-sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                ← Prev
              </button>
              <span>Page {page} of {pages}</span>
              <button
                className="btn-outline-sm"
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page === pages}
              >
                Next →
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
