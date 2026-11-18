import { useEffect, useState, useCallback } from "react";
import api from "../../api/axios";
import AdminLayout from "../../components/AdminLayout";
import toast from "react-hot-toast";
import { OverviewTab, BannersTab } from "./StorefrontParts1";
import { FeaturedTab, PromotionsTab, AnnouncementTab, SectionsTab, PreviewTab } from "./StorefrontParts2";

const TABS = [
  { key: "overview",     label: "Overview" },
  { key: "banners",      label: "Banners" },
  { key: "featured",     label: "Featured Pizzas" },
  { key: "promotions",   label: "Promotions" },
  { key: "announcement", label: "Announcement" },
  { key: "sections",     label: "Sections" },
  { key: "preview",      label: "Preview & Publish" },
];

export default function AdminStorefront() {
  const [tab, setTab]                   = useState("overview");
  const [draft, setDraft]               = useState(null);
  const [allPizzas, setAllPizzas]       = useState([]);
  const [lastPublishedAt, setLastPublishedAt] = useState(null);
  const [loading, setLoading]           = useState(true);
  const [publishing, setPublishing]     = useState(false);

  const fetchDraft = useCallback(async () => {
    try {
      const [draftRes, pizzaRes] = await Promise.all([
        api.get("/storefront/draft"),
        api.get("/pizzas?includeUnavailable=true"),
      ]);
      setDraft(draftRes.data.draft);
      setLastPublishedAt(draftRes.data.lastPublishedAt);
      setAllPizzas(pizzaRes.data.pizzas || []);
    } catch (err) {
      toast.error("Failed to load storefront data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDraft(); }, [fetchDraft]);

  const handlePublish = async () => {
    if (!window.confirm("Publish the current draft to the live customer website?")) return;
    setPublishing(true);
    try {
      const { data } = await api.post("/storefront/publish");
      setLastPublishedAt(data.lastPublishedAt);
      toast.success("Storefront published successfully!");
    } catch (err) {
      toast.error(err.response?.data?.message || "Publish failed");
    } finally {
      setPublishing(false);
    }
  };

  const handleDiscard = async () => {
    if (!window.confirm("Discard all draft changes and reset to the last published state?")) return;
    try {
      await api.post("/storefront/discard");
      toast.success("Draft discarded");
      fetchDraft();
    } catch {
      toast.error("Discard failed");
    }
  };

  return (
    <AdminLayout pageTitle="Storefront">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.75rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <p style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--red)", marginBottom: "0.25rem" }}>
            Admin Panel
          </p>
          <h2 className="section-title" style={{ margin: 0 }}>Storefront Management</h2>
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button className="btn-outline-sm" onClick={handleDiscard}>Discard Draft</button>
          <button className="btn-primary-sm" onClick={handlePublish} disabled={publishing}>
            {publishing ? "Publishing…" : "🚀 Publish"}
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 0, marginBottom: "1.75rem", borderBottom: "2px solid var(--cream-border)", overflowX: "auto" }}>
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: "0.6rem 1.1rem", background: "none", border: "none",
              borderBottom: tab === key ? "2px solid var(--red)" : "2px solid transparent",
              marginBottom: "-2px", fontWeight: tab === key ? 700 : 500,
              color: tab === key ? "var(--red)" : "var(--charcoal-soft)",
              cursor: "pointer", fontSize: "0.88rem", whiteSpace: "nowrap",
              transition: "color 0.15s",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : (
        <>
          {tab === "overview" && (
            <OverviewTab
              draft={draft}
              lastPublishedAt={lastPublishedAt}
              onPublish={handlePublish}
              onDiscard={handleDiscard}
              publishing={publishing}
            />
          )}
          {tab === "banners" && (
            <BannersTab
              banners={draft?.banners || []}
              onRefresh={fetchDraft}
            />
          )}
          {tab === "featured" && (
            <FeaturedTab
              draftFeatured={draft?.featuredPizzas || []}
              allPizzas={allPizzas}
              onRefresh={fetchDraft}
            />
          )}
          {tab === "promotions" && (
            <PromotionsTab
              promotions={draft?.promotions || []}
              onRefresh={fetchDraft}
            />
          )}
          {tab === "announcement" && (
            <AnnouncementTab
              announcement={draft?.announcement}
              onRefresh={fetchDraft}
            />
          )}
          {tab === "sections" && (
            <SectionsTab
              sections={draft?.sections || []}
              onRefresh={fetchDraft}
            />
          )}
          {tab === "preview" && (
            <PreviewTab
              draft={draft}
              allPizzas={allPizzas}
              lastPublishedAt={lastPublishedAt}
              onPublish={handlePublish}
              onDiscard={handleDiscard}
              publishing={publishing}
            />
          )}
        </>
      )}
    </AdminLayout>
  );
}
