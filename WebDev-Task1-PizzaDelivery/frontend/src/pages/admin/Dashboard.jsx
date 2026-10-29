import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import AdminSidebar from "../../components/AdminSidebar";

const STATUS_ACCENT = {
  pending: "var(--amber)", confirmed: "#3b82f6", preparing: "#8b5cf6",
  out_for_delivery: "#06b6d4", delivered: "var(--green)", cancelled: "var(--red)",
};

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/orders/admin/stats"),
      api.get("/orders?limit=8"),
    ]).then(([statsRes, ordersRes]) => {
      setStats(statsRes.data);
      setRecent(ordersRes.data.orders);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div className="admin-layout">
      <AdminSidebar />
      <main className="admin-main">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <p style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--red)", marginBottom: "0.25rem" }}>
              Admin Panel
            </p>
            <h2 className="section-title" style={{ margin: 0 }}>Dashboard</h2>
          </div>
          <Link to="/admin/orders" className="btn-primary-sm">Manage Orders →</Link>
        </div>

        {loading ? (
          <div className="loading"><div className="spinner" /></div>
        ) : (
          <>
            {/* Stats */}
            {stats && (
              <div className="stats-grid">
                <div className="stat-card" style={{ borderTopColor: "var(--green)" }}>
                  <p className="stat-label">Total Revenue</p>
                  <p className="stat-value">₹{stats.totalRevenue.toLocaleString("en-IN")}</p>
                </div>
                {Object.entries(stats.statusCounts).map(([status, count]) => (
                  <div key={status} className="stat-card" style={{ borderTopColor: STATUS_ACCENT[status] || "var(--red)" }}>
                    <p className="stat-label">{status.replace(/_/g, " ")}</p>
                    <p className="stat-value">{count}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Recent orders */}
            <div className="card" style={{ marginTop: "0.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
                <h3 style={{ margin: 0 }}>Recent Orders</h3>
                <Link to="/admin/orders" className="btn-outline-sm">View All</Link>
              </div>

              {recent.length === 0 ? (
                <div className="empty-state" style={{ padding: "2rem" }}>
                  <span className="empty-state-icon">📦</span>
                  <p>No orders yet.</p>
                </div>
              ) : (
                <div className="table-wrapper">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Order ID</th>
                        <th>Customer</th>
                        <th>Items</th>
                        <th>Total</th>
                        <th>Status</th>
                        <th>Date</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {recent.map((o) => (
                        <tr key={o._id}>
                          <td style={{ fontFamily: "monospace", fontSize: "0.82rem" }}>
                            #{o._id.slice(-8).toUpperCase()}
                          </td>
                          <td>
                            <p style={{ fontWeight: 600, fontSize: "0.88rem" }}>{o.user?.name}</p>
                            <p style={{ fontSize: "0.75rem", color: "var(--charcoal-soft)" }}>{o.user?.email}</p>
                          </td>
                          <td>{o.items.length} item{o.items.length !== 1 ? "s" : ""}</td>
                          <td style={{ fontWeight: 700 }}>₹{o.total}</td>
                          <td>
                            <span className={`status-badge ${o.status}`}>
                              {o.status.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td style={{ fontSize: "0.82rem", color: "var(--charcoal-soft)" }}>
                            {new Date(o.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                          </td>
                          <td>
                            <Link to={`/orders/${o._id}`} className="btn-outline-sm">View</Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
