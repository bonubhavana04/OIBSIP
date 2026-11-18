import { useState } from "react";
import api from "../../api/axios";
import toast from "react-hot-toast";

const overlayStyle = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
};
const modalStyle = {
  background: "var(--white)", borderRadius: "var(--r-lg)",
  padding: "2rem", width: "min(560px, 95vw)", maxHeight: "90vh",
  overflowY: "auto", boxShadow: "var(--shadow-xl)",
};
const toInputDate = (d) => d ? new Date(d).toISOString().slice(0, 10) : "";
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

// ── Featured Pizzas tab ───────────────────────────────────────────────────────
function FeaturedTab({ draftFeatured, allPizzas, onRefresh }) {
  const [saving, setSaving] = useState(false);
  const featuredIds = draftFeatured.map((p) => p._id || p);

  const toggle = async (pizzaId) => {
    const next = featuredIds.includes(pizzaId)
      ? featuredIds.filter((id) => id !== pizzaId)
      : [...featuredIds, pizzaId];
    setSaving(true);
    try {
      await api.put("/storefront/featured", { pizzaIds: next });
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const moveUp = async (idx) => {
    if (idx === 0) return;
    const next = [...featuredIds];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setSaving(true);
    try {
      await api.put("/storefront/featured", { pizzaIds: next });
      onRefresh();
    } catch { toast.error("Reorder failed"); }
    finally { setSaving(false); }
  };

  const moveDown = async (idx) => {
    if (idx === featuredIds.length - 1) return;
    const next = [...featuredIds];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    setSaving(true);
    try {
      await api.put("/storefront/featured", { pizzaIds: next });
      onRefresh();
    } catch { toast.error("Reorder failed"); }
    finally { setSaving(false); }
  };

  const featuredPizzas = featuredIds
    .map((id) => allPizzas.find((p) => p._id === id))
    .filter(Boolean);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h3 style={{ margin: 0 }}>Featured Pizzas <span style={{ color: "var(--charcoal-soft)", fontWeight: 400, fontSize: "0.9rem" }}>({featuredIds.length} selected)</span></h3>
        {saving && <span style={{ fontSize: "0.82rem", color: "var(--charcoal-soft)" }}>Saving…</span>}
      </div>

      {featuredPizzas.length > 0 && (
        <div className="card" style={{ marginBottom: "1.5rem", padding: "1rem" }}>
          <p style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--red)", marginBottom: "0.75rem" }}>Selected Order</p>
          {featuredPizzas.map((p, idx) => (
            <div key={p._id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.5rem 0", borderBottom: idx < featuredPizzas.length - 1 ? "1px solid var(--cream-border)" : "none" }}>
              <span style={{ fontWeight: 700, color: "var(--charcoal-soft)", width: 20, textAlign: "center", fontSize: "0.82rem" }}>{idx + 1}</span>
              <span style={{ flex: 1, fontWeight: 600, fontSize: "0.88rem" }}>{p.name}</span>
              <span style={{ fontSize: "0.78rem", color: "var(--charcoal-soft)" }}>{p.isVeg ? "🟢 Veg" : "🔴 Non-Veg"}</span>
              <div style={{ display: "flex", gap: "0.3rem" }}>
                <button className="btn-ghost" style={{ padding: "0.2rem 0.5rem", fontSize: "0.8rem" }} onClick={() => moveUp(idx)} disabled={idx === 0}>↑</button>
                <button className="btn-ghost" style={{ padding: "0.2rem 0.5rem", fontSize: "0.8rem" }} onClick={() => moveDown(idx)} disabled={idx === featuredPizzas.length - 1}>↓</button>
                <button className="btn-ghost danger" style={{ fontSize: "0.78rem" }} onClick={() => toggle(p._id)}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h4 style={{ marginBottom: "0.75rem", fontSize: "0.88rem", color: "var(--charcoal-mid)" }}>All Available Pizzas</h4>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "0.75rem" }}>
        {allPizzas.map((p) => {
          const selected = featuredIds.includes(p._id);
          return (
            <div key={p._id} className="card" style={{ padding: "0.85rem 1rem", display: "flex", alignItems: "center", gap: "0.75rem", border: selected ? "2px solid var(--red)" : "1px solid var(--cream-border)", cursor: "pointer" }} onClick={() => toggle(p._id)}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 600, fontSize: "0.88rem", marginBottom: "0.15rem" }}>{p.name}</p>
                <p style={{ fontSize: "0.75rem", color: "var(--charcoal-soft)" }}>{p.category?.name} · {p.isVeg ? "Veg" : "Non-Veg"}</p>
              </div>
              <div style={{ width: 22, height: 22, borderRadius: "50%", border: "2px solid", borderColor: selected ? "var(--red)" : "var(--cream-border)", background: selected ? "var(--red)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {selected && <span style={{ color: "white", fontSize: "0.7rem", fontWeight: 700 }}>✓</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Promotion modal ───────────────────────────────────────────────────────────
const BLANK_PROMO = { title: "", description: "", discountType: "percentage", discountValue: "", promoCode: "", minOrderAmount: "", startDate: "", endDate: "", isActive: true };

function PromoModal({ promo, onClose, onSave, saving }) {
  const [form, setForm] = useState(promo ? {
    title: promo.title || "", description: promo.description || "",
    discountType: promo.discountType || "percentage",
    discountValue: promo.discountValue ?? "",
    promoCode: promo.promoCode || "", minOrderAmount: promo.minOrderAmount ?? "",
    startDate: toInputDate(promo.startDate), endDate: toInputDate(promo.endDate),
    isActive: promo.isActive !== false,
  } : { ...BLANK_PROMO });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginBottom: "1.25rem" }}>{promo ? "Edit Promotion" : "New Promotion"}</h3>
        <div className="form-group">
          <label>Title *</label>
          <input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Weekend Special" autoFocus />
        </div>
        <div className="form-group">
          <label>Description</label>
          <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} style={{ width: "100%", padding: "0.7rem 1rem", border: "1.5px solid var(--cream-border)", borderRadius: "var(--r-sm)", fontSize: "0.95rem", resize: "vertical" }} />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Discount Type *</label>
            <select value={form.discountType} onChange={(e) => set("discountType", e.target.value)} style={{ width: "100%", padding: "0.7rem 1rem", border: "1.5px solid var(--cream-border)", borderRadius: "var(--r-sm)", fontSize: "0.95rem" }}>
              <option value="percentage">Percentage (%)</option>
              <option value="fixed">Fixed Amount (₹)</option>
            </select>
          </div>
          <div className="form-group">
            <label>Discount Value *</label>
            <input type="number" min={0} max={form.discountType === "percentage" ? 100 : undefined} value={form.discountValue} onChange={(e) => set("discountValue", e.target.value)} placeholder={form.discountType === "percentage" ? "20" : "50"} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Promo Code (optional)</label>
            <input value={form.promoCode} onChange={(e) => set("promoCode", e.target.value.toUpperCase())} placeholder="SAVE20" />
          </div>
          <div className="form-group">
            <label>Min. Order Amount ₹</label>
            <input type="number" min={0} value={form.minOrderAmount} onChange={(e) => set("minOrderAmount", e.target.value)} placeholder="0" />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Start Date</label>
            <input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
          </div>
          <div className="form-group">
            <label>End Date</label>
            <input type="date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} />
          </div>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.88rem", cursor: "pointer", marginBottom: "1.25rem" }}>
          <input type="checkbox" checked={form.isActive} onChange={(e) => set("isActive", e.target.checked)} />
          Active
        </label>
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
          <button className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => onSave(form)} disabled={saving}>{saving ? "Saving…" : "Save Promotion"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Promotions tab ────────────────────────────────────────────────────────────
function PromotionsTab({ promotions, onRefresh }) {
  const [modal, setModal]   = useState(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async (form) => {
    setSaving(true);
    try {
      const payload = { ...form, discountValue: Number(form.discountValue), minOrderAmount: Number(form.minOrderAmount) || 0 };
      if (modal.promo) {
        await api.put(`/storefront/promotions/${modal.promo._id}`, payload);
        toast.success("Promotion updated");
      } else {
        await api.post("/storefront/promotions", payload);
        toast.success("Promotion created");
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
    if (!window.confirm("Delete this promotion?")) return;
    try {
      await api.delete(`/storefront/promotions/${id}`);
      toast.success("Promotion deleted");
      onRefresh();
    } catch { toast.error("Delete failed"); }
  };

  const toggleActive = async (promo) => {
    try {
      await api.put(`/storefront/promotions/${promo._id}`, { isActive: !promo.isActive });
      onRefresh();
    } catch { toast.error("Update failed"); }
  };

  const now = Date.now();
  const isExpired = (p) => p.endDate && new Date(p.endDate).getTime() < now;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h3 style={{ margin: 0 }}>Promotions & Offers <span style={{ color: "var(--charcoal-soft)", fontWeight: 400, fontSize: "0.9rem" }}>({promotions.length})</span></h3>
        <button className="btn-primary-sm" onClick={() => setModal({ promo: null })}>+ New Promotion</button>
      </div>

      {promotions.length === 0 ? (
        <div className="empty-state" style={{ padding: "3rem" }}>
          <span className="empty-state-icon">🎁</span>
          <h2>No promotions yet</h2>
          <p>Create offers and promo codes for your customers.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {promotions.map((p) => (
            <div key={p._id} className="card" style={{ padding: "1.1rem 1.4rem", display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap", opacity: isExpired(p) ? 0.6 : 1 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.2rem" }}>
                  <p style={{ fontWeight: 700 }}>{p.title}</p>
                  {isExpired(p) && <span style={{ fontSize: "0.7rem", background: "#fee2e2", color: "#b91c1c", padding: "1px 6px", borderRadius: 4, fontWeight: 700 }}>EXPIRED</span>}
                  {p.promoCode && <span style={{ fontSize: "0.75rem", background: "var(--cream-dark)", border: "1px solid var(--cream-border)", padding: "1px 8px", borderRadius: 4, fontFamily: "monospace", fontWeight: 700 }}>{p.promoCode}</span>}
                </div>
                <p style={{ fontSize: "0.82rem", color: "var(--charcoal-soft)" }}>
                  {p.discountType === "percentage" ? `${p.discountValue}% off` : `₹${p.discountValue} off`}
                  {p.minOrderAmount > 0 && ` · Min ₹${p.minOrderAmount}`}
                  {(p.startDate || p.endDate) && ` · ${fmtDate(p.startDate)} – ${fmtDate(p.endDate)}`}
                </p>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
                <button onClick={() => toggleActive(p)} className={p.isActive ? "btn-primary-sm" : "btn-outline-sm"} style={{ fontSize: "0.75rem" }}>
                  {p.isActive ? "Active" : "Inactive"}
                </button>
                <button className="btn-outline-sm" onClick={() => setModal({ promo: p })}>Edit</button>
                <button className="btn-ghost danger" style={{ fontSize: "0.78rem" }} onClick={() => handleDelete(p._id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && <PromoModal promo={modal.promo} onClose={() => setModal(null)} onSave={handleSave} saving={saving} />}
    </div>
  );
}

// ── Announcement tab ──────────────────────────────────────────────────────────
function AnnouncementTab({ announcement, onRefresh }) {
  const [form, setForm] = useState({
    text:      announcement?.text      || "",
    isActive:  announcement?.isActive  || false,
    style:     announcement?.style     || "promo",
    startDate: toInputDate(announcement?.startDate),
    endDate:   toInputDate(announcement?.endDate),
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put("/storefront/announcement", form);
      toast.success("Announcement saved");
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const styleColors = { promo: "var(--red)", info: "#1d4ed8", warning: "var(--amber)" };

  return (
    <div>
      <h3 style={{ marginBottom: "1.5rem" }}>Announcement Bar</h3>

      {form.text && (
        <div style={{ background: styleColors[form.style] || "var(--red)", color: "white", padding: "0.6rem 1.5rem", borderRadius: "var(--r-sm)", textAlign: "center", fontSize: "0.88rem", fontWeight: 600, marginBottom: "1.5rem" }}>
          {form.text} <span style={{ opacity: 0.7, fontSize: "0.75rem" }}>(preview)</span>
        </div>
      )}

      <div className="card">
        <div className="form-group">
          <label>Announcement Text (max 200 chars)</label>
          <input value={form.text} onChange={(e) => set("text", e.target.value)} maxLength={200} placeholder="Free delivery on orders above ₹499!" />
          <p style={{ fontSize: "0.75rem", color: "var(--charcoal-soft)", marginTop: "0.25rem" }}>{form.text.length}/200</p>
        </div>

        <div className="form-group">
          <label>Style</label>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            {[{ key: "promo", label: "Promo (Red)" }, { key: "info", label: "Info (Blue)" }, { key: "warning", label: "Warning (Amber)" }].map((s) => (
              <label key={s.key} style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer", fontSize: "0.88rem" }}>
                <input type="radio" name="style" value={s.key} checked={form.style === s.key} onChange={() => set("style", s.key)} />
                {s.label}
              </label>
            ))}
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
          Show announcement bar on customer website
        </label>

        <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save Announcement"}</button>
      </div>
    </div>
  );
}

// ── Sections tab ──────────────────────────────────────────────────────────────
function SectionsTab({ sections, onRefresh }) {
  const [local, setLocal]   = useState([...sections].sort((a, b) => a.order - b.order));
  const [saving, setSaving] = useState(false);

  const toggle = (key) => setLocal((prev) => prev.map((s) => s.key === key ? { ...s, isVisible: !s.isVisible } : s));

  const moveUp = (idx) => {
    if (idx === 0) return;
    setLocal((prev) => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next.map((s, i) => ({ ...s, order: i }));
    });
  };

  const moveDown = (idx) => {
    if (idx === local.length - 1) return;
    setLocal((prev) => {
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next.map((s, i) => ({ ...s, order: i }));
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put("/storefront/sections", { sections: local.map((s, i) => ({ ...s, order: i })) });
      toast.success("Sections saved");
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h3 style={{ margin: 0 }}>Homepage Sections</h3>
        <button className="btn-primary-sm" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save Order"}</button>
      </div>
      <p style={{ fontSize: "0.85rem", color: "var(--charcoal-soft)", marginBottom: "1.25rem" }}>
        Toggle visibility and drag sections into the order you want. Click Save Order to apply.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {local.map((s, idx) => (
          <div key={s.key} className="card" style={{ padding: "0.85rem 1.1rem", display: "flex", alignItems: "center", gap: "1rem", border: s.isVisible ? "1px solid var(--cream-border)" : "1px dashed var(--cream-border)", opacity: s.isVisible ? 1 : 0.55 }}>
            <span style={{ fontWeight: 700, color: "var(--charcoal-soft)", width: 24, textAlign: "center", fontSize: "0.82rem" }}>{idx + 1}</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 600, fontSize: "0.9rem" }}>{s.label}</p>
              <p style={{ fontSize: "0.75rem", color: "var(--charcoal-soft)" }}>{s.key}</p>
            </div>
            <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
              <button className="btn-ghost" style={{ padding: "0.2rem 0.5rem", fontSize: "0.8rem" }} onClick={() => moveUp(idx)} disabled={idx === 0}>↑</button>
              <button className="btn-ghost" style={{ padding: "0.2rem 0.5rem", fontSize: "0.8rem" }} onClick={() => moveDown(idx)} disabled={idx === local.length - 1}>↓</button>
              <button onClick={() => toggle(s.key)} className={s.isVisible ? "btn-primary-sm" : "btn-outline-sm"} style={{ fontSize: "0.75rem" }}>
                {s.isVisible ? "Visible" : "Hidden"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Preview & Publish tab ────────────────────────────────────────────────────
function PreviewTab({ draft, allPizzas, lastPublishedAt, onPublish, onDiscard, publishing }) {
  const fmtDateTime = (d) =>
    d ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Never published";

  const now = Date.now();
  const activeBanners = (draft?.banners || []).filter((b) => b.isActive);
  const activePromos  = (draft?.promotions || []).filter((p) => p.isActive && (!p.endDate || new Date(p.endDate).getTime() > now));
  const featuredIds   = (draft?.featuredPizzas || []).map((p) => p._id || p);
  const featuredPizzas = featuredIds.map((id) => allPizzas.find((p) => p._id === id)).filter(Boolean);
  const visibleSections = (draft?.sections || []).filter((s) => s.isVisible).sort((a, b) => a.order - b.order);
  const ann = draft?.announcement;
  const annActive = ann?.isActive && ann?.text;

  const styleColors = { promo: "var(--red)", info: "#1d4ed8", warning: "var(--amber)" };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h3 style={{ margin: 0, marginBottom: "0.25rem" }}>Preview & Publish</h3>
          <p style={{ fontSize: "0.82rem", color: "var(--charcoal-soft)" }}>Last published: {fmtDateTime(lastPublishedAt)}</p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button className="btn-outline-sm" onClick={onDiscard}>Discard Draft</button>
          <button className="btn-primary-sm" onClick={onPublish} disabled={publishing}>
            {publishing ? "Publishing…" : "🚀 Publish to Live Site"}
          </button>
        </div>
      </div>

      {/* Draft summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "0.75rem", marginBottom: "1.5rem" }}>
        {[
          { label: "Active Banners",   value: activeBanners.length,   icon: "🖼️" },
          { label: "Featured Pizzas",  value: featuredPizzas.length,  icon: "🍕" },
          { label: "Active Promos",    value: activePromos.length,    icon: "🎁" },
          { label: "Visible Sections", value: visibleSections.length, icon: "📄" },
          { label: "Announcement",     value: annActive ? "On" : "Off", icon: "📢" },
        ].map((s) => (
          <div key={s.label} className="card" style={{ padding: "1rem", textAlign: "center" }}>
            <span style={{ fontSize: "1.5rem" }}>{s.icon}</span>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "1.4rem", fontWeight: 800, color: "var(--charcoal)", margin: "0.25rem 0 0" }}>{s.value}</p>
            <p style={{ fontSize: "0.75rem", color: "var(--charcoal-soft)" }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Announcement preview */}
      {annActive && (
        <div style={{ background: styleColors[ann.style] || "var(--red)", color: "white", padding: "0.55rem 1.5rem", borderRadius: "var(--r-sm)", textAlign: "center", fontSize: "0.88rem", fontWeight: 600, marginBottom: "1rem" }}>
          📢 {ann.text}
        </div>
      )}

      {/* Banner preview */}
      {activeBanners.length > 0 && (
        <div className="card" style={{ marginBottom: "1rem" }}>
          <p style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--red)", marginBottom: "0.75rem" }}>Banners ({activeBanners.length})</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {activeBanners.sort((a, b) => a.order - b.order).map((b) => (
              <div key={b._id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.5rem", background: "var(--cream)", borderRadius: "var(--r-sm)" }}>
                {b.image && <img src={b.image} alt="" style={{ width: 60, height: 38, objectFit: "cover", borderRadius: 4, flexShrink: 0 }} onError={(e) => { e.target.style.display = "none"; }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, fontSize: "0.88rem" }}>{b.heading}</p>
                  {b.ctaLabel && <p style={{ fontSize: "0.75rem", color: "var(--charcoal-soft)" }}>CTA: {b.ctaLabel}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Featured pizzas preview */}
      {featuredPizzas.length > 0 && (
        <div className="card" style={{ marginBottom: "1rem" }}>
          <p style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--red)", marginBottom: "0.75rem" }}>Featured Pizzas ({featuredPizzas.length})</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {featuredPizzas.map((p, i) => (
              <span key={p._id} style={{ background: "var(--cream-dark)", border: "1px solid var(--cream-border)", borderRadius: "var(--r-full)", padding: "0.25rem 0.75rem", fontSize: "0.82rem", fontWeight: 600 }}>
                {i + 1}. {p.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Section order preview */}
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <p style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--red)", marginBottom: "0.75rem" }}>Section Order</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          {(draft?.sections || []).sort((a, b) => a.order - b.order).map((s, i) => (
            <div key={s.key} style={{ display: "flex", alignItems: "center", gap: "0.75rem", opacity: s.isVisible ? 1 : 0.45 }}>
              <span style={{ width: 20, textAlign: "center", fontSize: "0.78rem", color: "var(--charcoal-soft)", fontWeight: 700 }}>{i + 1}</span>
              <span style={{ flex: 1, fontSize: "0.88rem", fontWeight: 600 }}>{s.label}</span>
              <span style={{ fontSize: "0.72rem", padding: "2px 8px", borderRadius: 4, background: s.isVisible ? "var(--green-light)" : "var(--cream-dark)", color: s.isVisible ? "var(--green)" : "var(--charcoal-soft)", fontWeight: 700 }}>
                {s.isVisible ? "Visible" : "Hidden"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Active promos preview */}
      {activePromos.length > 0 && (
        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <p style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--red)", marginBottom: "0.75rem" }}>Active Promotions ({activePromos.length})</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {activePromos.map((p) => (
              <div key={p._id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.85rem" }}>
                <span style={{ flex: 1, fontWeight: 600 }}>{p.title}</span>
                {p.promoCode && <span style={{ fontFamily: "monospace", background: "var(--cream-dark)", padding: "1px 8px", borderRadius: 4, fontSize: "0.78rem", fontWeight: 700 }}>{p.promoCode}</span>}
                <span style={{ color: "var(--charcoal-soft)", fontSize: "0.78rem" }}>
                  {p.discountType === "percentage" ? `${p.discountValue}% off` : `₹${p.discountValue} off`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ background: "var(--red-light)", border: "1px solid var(--red-muted)" }}>
        <p style={{ fontSize: "0.88rem", color: "var(--charcoal)", lineHeight: 1.7 }}>
          <strong>Ready to go live?</strong> Click <strong>Publish to Live Site</strong> above to push all draft changes to the customer-facing website instantly.
          Customers will see the updated banners, featured pizzas, promotions, announcement bar, and section order.
        </p>
      </div>
    </div>
  );
}

export { FeaturedTab, PromotionsTab, AnnouncementTab, SectionsTab, PreviewTab };
