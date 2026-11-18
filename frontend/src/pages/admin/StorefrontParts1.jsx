import { useState } from "react";
import api from "../../api/axios";
import toast from "react-hot-toast";

// ── Shared helpers ────────────────────────────────────────────────────────────
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
const fmtDateTime = (d) => d ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Never published";
const toInputDate = (d) => d ? new Date(d).toISOString().slice(0, 10) : "";

const overlayStyle = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
};
const modalStyle = {
  background: "var(--white)", borderRadius: "var(--r-lg)",
  padding: "2rem", width: "min(560px, 95vw)", maxHeight: "90vh",
  overflowY: "auto", boxShadow: "var(--shadow-xl)",
};

// ── Overview tab ──────────────────────────────────────────────────────────────
function OverviewTab({ draft, lastPublishedAt, onPublish, onDiscard, publishing }) {
  return (
    <div>
      <div className="card" style={{ marginBottom: "1.5rem", borderLeft: "4px solid var(--red)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h3 style={{ margin: 0, marginBottom: "0.3rem" }}>Storefront Status</h3>
            <p style={{ fontSize: "0.85rem", color: "var(--charcoal-soft)" }}>
              Last published: {fmtDateTime(lastPublishedAt)}
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button className="btn-outline-sm" onClick={onDiscard}>Discard Draft</button>
            <button className="btn-primary-sm" onClick={onPublish} disabled={publishing}>
              {publishing ? "Publishing…" : "Publish Now"}
            </button>
          </div>
        </div>
      </div>

      <div className="stats-grid">
        {[
          { label: "Banners",        value: draft?.banners?.length || 0,     color: "#3b82f6" },
          { label: "Featured Pizzas",value: draft?.featuredPizzas?.length || 0, color: "var(--green)" },
          { label: "Promotions",     value: draft?.promotions?.length || 0,  color: "var(--amber)" },
          { label: "Announcement",   value: draft?.announcement?.isActive ? "Active" : "Off", color: "var(--red)" },
        ].map((s) => (
          <div key={s.label} className="stat-card" style={{ borderTopColor: s.color }}>
            <p className="stat-label">{s.label}</p>
            <p className="stat-value" style={{ fontSize: "1.6rem" }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: "1.5rem" }}>
        <h3 style={{ marginBottom: "0.75rem" }}>Quick Guide</h3>
        <ul style={{ paddingLeft: "1.25rem", color: "var(--charcoal-soft)", fontSize: "0.88rem", lineHeight: 2 }}>
          <li>Edit content in any tab — changes are saved to the <strong>draft</strong>.</li>
          <li>Click <strong>Publish Now</strong> to push the draft live to customers.</li>
          <li><strong>Discard Draft</strong> resets the draft back to the last published state.</li>
          <li>Customers always see the last <strong>published</strong> version.</li>
        </ul>
      </div>
    </div>
  );
}

// ── Banner modal ──────────────────────────────────────────────────────────────
const BLANK_BANNER = { heading: "", description: "", image: "", ctaLabel: "", ctaUrl: "", isActive: true, startDate: "", endDate: "" };

const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES  = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function BannerModal({ banner, onClose, onSave, saving }) {
  const [form, setForm] = useState(banner ? {
    heading: banner.heading || "", description: banner.description || "",
    image: banner.image || "", ctaLabel: banner.ctaLabel || "",
    ctaUrl: banner.ctaUrl || "", isActive: banner.isActive !== false,
    startDate: toInputDate(banner.startDate), endDate: toInputDate(banner.endDate),
  } : { ...BLANK_BANNER });
  const [uploadMode, setUploadMode] = useState(banner?.image?.startsWith("data:") ? "file" : "url");

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Only JPEG, PNG, WebP or GIF images are allowed");
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      toast.error("Image must be under 2 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => set("image", ev.target.result);
    reader.readAsDataURL(file);
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginBottom: "1.25rem" }}>{banner ? "Edit Banner" : "New Banner"}</h3>
        <div className="form-group">
          <label>Heading *</label>
          <input value={form.heading} onChange={(e) => set("heading", e.target.value)} placeholder="Pizza Worth Every Craving" autoFocus />
        </div>
        <div className="form-group">
          <label>Description</label>
          <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} style={{ width: "100%", padding: "0.7rem 1rem", border: "1.5px solid var(--cream-border)", borderRadius: "var(--r-sm)", fontSize: "0.95rem", resize: "vertical" }} placeholder="Artisan pizzas delivered in 45 minutes…" />
        </div>

        {/* Image — URL or file upload */}
        <div className="form-group">
          <label>Banner Image</label>
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
            {["url", "file"].map((m) => (
              <label key={m} style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.82rem", cursor: "pointer" }}>
                <input type="radio" name="imgMode" value={m} checked={uploadMode === m} onChange={() => { setUploadMode(m); set("image", ""); }} />
                {m === "url" ? "Image URL" : "Upload file"}
              </label>
            ))}
          </div>
          {uploadMode === "url" ? (
            <input value={form.image} onChange={(e) => set("image", e.target.value)} placeholder="https://example.com/banner.jpg" />
          ) : (
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleFileChange}
              style={{ padding: "0.4rem 0", fontSize: "0.88rem" }} />
          )}
          {form.image && (
            <img src={form.image} alt="preview" style={{ marginTop: "0.5rem", maxHeight: 80, borderRadius: "var(--r-sm)", objectFit: "cover" }}
              onError={(e) => { e.target.style.display = "none"; }} />
          )}
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>CTA Button Label</label>
            <input value={form.ctaLabel} onChange={(e) => set("ctaLabel", e.target.value)} placeholder="Order Now" />
          </div>
          <div className="form-group">
            <label>CTA Destination URL</label>
            <input value={form.ctaUrl} onChange={(e) => set("ctaUrl", e.target.value)} placeholder="/menu" />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Start Date (optional)</label>
            <input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
          </div>
          <div className="form-group">
            <label>End Date (optional)</label>
            <input type="date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} />
          </div>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.88rem", cursor: "pointer", marginBottom: "1.25rem" }}>
          <input type="checkbox" checked={form.isActive} onChange={(e) => set("isActive", e.target.checked)} />
          Active (visible when published)
        </label>
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
          <button className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => onSave(form)} disabled={saving}>{saving ? "Saving…" : "Save Banner"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Banners tab ───────────────────────────────────────────────────────────────
function BannersTab({ banners, onRefresh }) {
  const [modal, setModal]   = useState(null); // null | { banner } | { banner: null }
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const handleSave = async (form) => {
    setSaving(true);
    try {
      if (modal.banner) {
        await api.put(`/storefront/banners/${modal.banner._id}`, form);
        toast.success("Banner updated");
      } else {
        await api.post("/storefront/banners", form);
        toast.success("Banner created");
      }
      setModal(null);
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this banner?")) return;
    setDeleting(id);
    try {
      await api.delete(`/storefront/banners/${id}`);
      toast.success("Banner deleted");
      onRefresh();
    } catch {
      toast.error("Delete failed");
    } finally {
      setDeleting(null);
    }
  };

  const toggleActive = async (banner) => {
    try {
      await api.put(`/storefront/banners/${banner._id}`, { isActive: !banner.isActive });
      onRefresh();
    } catch {
      toast.error("Update failed");
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h3 style={{ margin: 0 }}>Homepage Banners <span style={{ color: "var(--charcoal-soft)", fontWeight: 400, fontSize: "0.9rem" }}>({banners.length})</span></h3>
        <button className="btn-primary-sm" onClick={() => setModal({ banner: null })}>+ New Banner</button>
      </div>

      {banners.length === 0 ? (
        <div className="empty-state" style={{ padding: "3rem" }}>
          <span className="empty-state-icon">🖼️</span>
          <h2>No banners yet</h2>
          <p>Create a banner to display on the customer homepage hero section.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {[...banners].sort((a, b) => a.order - b.order).map((b) => (
            <div key={b._id} className="card" style={{ padding: "1.1rem 1.4rem", display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
              {b.image && (
                <img src={b.image} alt="" style={{ width: 80, height: 50, objectFit: "cover", borderRadius: "var(--r-sm)", flexShrink: 0 }} onError={(e) => { e.target.style.display = "none"; }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 700, marginBottom: "0.2rem" }}>{b.heading}</p>
                {b.description && <p style={{ fontSize: "0.8rem", color: "var(--charcoal-soft)", marginBottom: "0.2rem" }}>{b.description.slice(0, 80)}{b.description.length > 80 ? "…" : ""}</p>}
                <p style={{ fontSize: "0.75rem", color: "var(--charcoal-soft)" }}>
                  {b.ctaLabel && b.ctaUrl ? `CTA: ${b.ctaLabel} → ${b.ctaUrl}` : "No CTA"}
                  {(b.startDate || b.endDate) && ` · ${fmtDate(b.startDate)} – ${fmtDate(b.endDate)}`}
                </p>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexShrink: 0 }}>
                <button
                  onClick={() => toggleActive(b)}
                  className={b.isActive ? "btn-primary-sm" : "btn-outline-sm"}
                  style={{ fontSize: "0.75rem" }}
                >
                  {b.isActive ? "Active" : "Inactive"}
                </button>
                <button className="btn-outline-sm" onClick={() => setModal({ banner: b })}>Edit</button>
                <button className="btn-ghost danger" style={{ fontSize: "0.78rem" }} onClick={() => handleDelete(b._id)} disabled={deleting === b._id}>
                  {deleting === b._id ? "…" : "Delete"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <BannerModal
          banner={modal.banner}
          onClose={() => setModal(null)}
          onSave={handleSave}
          saving={saving}
        />
      )}
    </div>
  );
}

export { OverviewTab, BannersTab };
