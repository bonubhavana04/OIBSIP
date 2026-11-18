const router = require("express").Router();
const { protect, adminOnly } = require("../middleware/auth");
const {
  getPublished, getDraft, publish, discardDraft,
  createBanner, updateBanner, deleteBanner, reorderBanners,
  setFeaturedPizzas,
  createPromotion, updatePromotion, deletePromotion,
  updateAnnouncement,
  updateSections,
  validatePromoCode,
} = require("../controllers/storefrontController");

// ── Public ────────────────────────────────────────────────────────────────────
router.get("/published",       getPublished);
router.post("/validate-promo", protect, validatePromoCode);  // requires login (customer)

// ── Admin only ────────────────────────────────────────────────────────────────
router.get( "/draft",           protect, adminOnly, getDraft);
router.post("/publish",         protect, adminOnly, publish);
router.post("/discard",         protect, adminOnly, discardDraft);

// Banners
router.post(  "/banners",          protect, adminOnly, createBanner);
router.put(   "/banners/reorder",  protect, adminOnly, reorderBanners);
router.put(   "/banners/:bannerId",protect, adminOnly, updateBanner);
router.delete("/banners/:bannerId",protect, adminOnly, deleteBanner);

// Featured pizzas
router.put("/featured", protect, adminOnly, setFeaturedPizzas);

// Promotions
router.post(  "/promotions",           protect, adminOnly, createPromotion);
router.put(   "/promotions/:promoId",  protect, adminOnly, updatePromotion);
router.delete("/promotions/:promoId",  protect, adminOnly, deletePromotion);

// Announcement
router.put("/announcement", protect, adminOnly, updateAnnouncement);

// Sections
router.put("/sections", protect, adminOnly, updateSections);

module.exports = router;
