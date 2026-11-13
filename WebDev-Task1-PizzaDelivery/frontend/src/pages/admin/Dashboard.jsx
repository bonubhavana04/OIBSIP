import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import AdminLayout from "../../components/AdminLayout";

const STATUS_ACCENT = {
  pending: "var(--amber)", confirmed: "#3b82f6", preparing: "#8b5cf6",
  out_for_delivery: "#06b6d4", delivered: "var(--green)", cancelled: "var(--red)",
};

export default function AdminDashboard() {
  const [stats, setStats]       = useState(null);
  const [recent, setRecent]     = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(false);

  useEffect(() => {
    Promise.all([
      api.get("/orders/admin/stats"),
      api.get("/orders?limit=8"),
      api.get("/inventory/admin/low-stock"),
    ])
      .then(([statsRes, ordersRes, lowRes]) => {
        setStats(statsRes.data);
        setRecent(ordersRes.data.orders);
        setLowStock(lowRes.data.items || []);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  // Derived counts from stats
  const pendingCount  = stats?.statusCounts?.pending  || 0;
  const paidCount     = stats ? Object.entries(stats.statusCounts)
    .filter(([s]) => !["pending", "cancelled"].includes(s))
    .reduce((sum, [, c]) => sum + c, 0) : 0;
  const totalOrders   = stats ? Object.values(stats.statusCounts).reduce((a, b) => a + b, 0) : 0;

  return (
    <AdminLayout pageTitle="Dashboard">
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
        ) : error ? (
          <div className="empty-state">
            <span className="empty-state-icon">⚠️</span>
            <h2>Failed to load dashboard</h2>
            <p>Check your connection and try again.</p>
            <button className="btn-primary" onClick={() => window.location.reload()}>Retry</button>
          </div>
        ) : (
          <>
            {/* Key metric cards */}
            <div className="stats-grid" style={{ marginBottom: "1.5rem" }}>
              <div className="stat-card" style={{ borderTopColor: "var(--green)" }}>
                <p className="stat-label">Total Revenue</p>
                <p className="stat-value">₹{(stats?.totalRevenue || 0).toLocaleString("en-IN")}</p>
              </div>
              <div className="stat-card" style={{ borderTopColor: "var(--charcoal-mid)" }}>
                <p className="stat-label">Total Orders</p>
                <p className="stat-value">{totalOrders}</p>
              </div>
              <div className="stat-card" style={{ borderTopColor: "var(--amber)" }}>
                <p className="stat-label">Pending Orders</p>
                <p className="stat-value">{pendingCount}</p>
                {pendingCount > 0 && (
                  <Link to="/admin/orders?status=pending" style={{ fontSize: "0.75rem", color: "var(--amber)", fontWeight: 600, marginTop: "0.4rem", display: "block" }}>
                    View →
                  </Link>
                )}
              </div>
              <div className="stat-card" style={{ borderTopColor: "#3b82f6" }}>
                <p className="stat-label">Active (Paid)</p>
                <p className="stat-value">{paidCount}</p>
              </div>
              <div className="stat-card" style={{ borderTopColor: lowStock.length > 0 ? "var(--red)" : "var(--green)" }}>
                <p className="stat-label">Low Stock Items</p>
                <p className="stat-value" style={{ color: lowStock.length > 0 ? "var(--red)" : "inherit" }}>
                  {lowStock.length}
                </p>
                {lowStock.length > 0 && (
                  <Link to="/admin/inventory" style={{ fontSize: "0.75rem", color: "var(--red)", fontWeight: 600, marginTop: "0.4rem", display: "block" }}>
                    Manage →
                  </Link>
                )}
              </div>
            </div>

            {/* Per-status breakdown */}
            {stats && Object.keys(stats.statusCounts).length > 0 && (
              <div className="card" style={{ marginBottom: "1.5rem" }}>
                <h3 style={{ marginBottom: "1rem" }}>Orders by Status</h3>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
                  {Object.entries(stats.statusCounts).map(([status, count]) => (
                    <Link
                      key={status}
                      to={`/admin/orders?status=${status}`}
                      style={{
                        display: "flex", flexDirection: "column", alignItems: "center",
                        padding: "0.75rem 1.25rem", borderRadius: "var(--r-sm)",
                        border: `2px solid ${STATUS_ACCENT[status] || "var(--cream-border)"}`,
                        background: "var(--white)", textDecoration: "none", minWidth: "90px",
                        transition: "transform 0.15s",
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-2px)"}
                      onMouseLeave={(e) => e.currentTarget.style.transform = "none"}
                    >
                      <span style={{ fontSize: "1.4rem", fontWeight: 800, color: STATUS_ACCENT[status] || "var(--charcoal)" }}>{count}</span>
                      <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--charcoal-soft)", textTransform: "capitalize", marginTop: "0.2rem" }}>
                        {status.replace(/_/g, " ")}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Low-stock alert */}
            {lowStock.length > 0 && (
              <div className="card" style={{ marginBottom: "1.5rem", borderLeft: "4px solid var(--amber)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                  <h3 style={{ margin: 0 }}>⚠️ Low Stock ({lowStock.length})</h3>
                  <Link to="/admin/inventory" className="btn-outline-sm">Manage →</Link>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {lowStock.map((item) => (
                    <span
                      key={item._id}
                      style={{
                        background: "var(--amber-light)", border: "1px solid var(--amber)",
                        borderRadius: "var(--r-sm)", padding: "0.3rem 0.7rem",
                        fontSize: "0.82rem", fontWeight: 600,
                      }}
                    >
                      {item.emoji} {item.name}
                      <span style={{ marginLeft: "0.4rem", color: "var(--amber)", fontWeight: 700 }}>
                        {item.stock} left
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Recent orders */}
            <div className="card">
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
                        <th>Payment</th>
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
                            <span className={`status-badge ${o.payment.status}`}>{o.payment.status}</span>
                          </td>
                          <td>
                            <span className={`status-badge ${o.status}`}>
                              {o.status.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td style={{ fontSize: "0.82rem", color: "var(--charcoal-soft)" }}>
                            {new Date(o.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                          </td>
                          <td>
                            <Link to={`/admin/orders/${o._id}`} className="btn-outline-sm">View</Link>
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
    </AdminLayout>
  );
}
