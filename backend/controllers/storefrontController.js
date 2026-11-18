const Storefront = require("../models/Storefront");
const Pizza      = require("../models/Pizza");
const { defaultSections } = require("../models/Storefront");

// ── Helper: get or create the single storefront document ─────────────────────
const getDoc = async () => {
  let doc = await Storefront.findOne();
  if (!doc) {
    doc = await Storefront.create({
      draft:     { sections: defaultSections() },
      published: { sections: defaultSections() },
    });
  }
  return doc;
};

// ── Helper: check if a promotion is currently valid ───────────────────────────
const isPromoValid = (promo) => {
  if (!promo.isActive) return false;
  const now = Date.now();
  if (promo.startDate && new Date(promo.startDate).getTime() > now) return false;
  if (promo.endDate   && new Date(promo.endDate).getTime()   < now) return false;
  return true;
};

// ── Helper: check if a banner is currently active ────────────────────────────
const isBannerActive = (banner) => {
  if (!banner.isActive) return false;
  const now = Date.now();
  if (banner.startDate && new Date(banner.startDate).getTime() > now) return false;
  if (banner.endDate   && new Date(banner.endDate).getTime()   < now) return false;
  return true;
};

// ── Helper: check if announcement is active ───────────────────────────────────
const isAnnouncementActive = (ann) => {
  if (!ann || !ann.isActive || !ann.text) return false;
  const now = Date.now();
  if (ann.startDate && new Date(ann.startDate).getTime() > now) return false;
  if (ann.endDate   && new Date(ann.endDate).getTime()   < now) return false;
  return true;
};

// ── Helper: validate image field (URL or base64) ─────────────────────────────────
const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_MIME    = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const validateImage = (image) => {
  if (!image) return null;
  if (image.startsWith("data:")) {
    const match = image.match(/^data:([^;]+);base64,/);
    if (!match) return "Invalid base64 image format";
    if (!ALLOWED_MIME.includes(match[1])) return "Image must be JPEG, PNG, WebP or GIF";
    const base64Data = image.split(",")[1] || "";
    const bytes = Math.ceil(base64Data.length * 0.75);
    if (bytes > MAX_IMAGE_BYTES) return "Image must be under 2 MB";
  }
  return null;
};

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC — GET /api/storefront/published
// Returns only the published config, filtered for currently-active items.
// No auth required — customers call this.
// ═══════════════════════════════════════════════════════════════════════════════
const getPublished = async (req, res) => {
  const doc = await getDoc();
  const pub = doc.published;

  // Populate featured pizza refs
  const featuredPizzas = await Pizza.find({
    _id:         { $in: pub.featuredPizzas },
    isAvailable: true,
  })
    .populate("category", "name emoji")
    .lean();

  // Preserve admin-defined order
  const orderedFeatured = pub.featuredPizzas
    .map((id) => featuredPizzas.find((p) => p._id.toString() === id.toString()))
    .filter(Boolean)
    .map((p) => ({ ...p, sizes: p.sizes.map((s) => ({ ...s, price: Math.round(s.priceP / 100) })) }));

  res.json({
    banners:        pub.banners.filter(isBannerActive).sort((a, b) => a.order - b.order),
    featuredPizzas: orderedFeatured,
    promotions:     pub.promotions.filter(isPromoValid),
    announcement:   isAnnouncementActive(pub.announcement) ? pub.announcement : null,
    sections:       (pub.sections || defaultSections()).sort((a, b) => a.order - b.order),
    lastPublishedAt: doc.lastPublishedAt,
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN — GET /api/storefront/draft
// Returns the full draft (admin only)
// ═══════════════════════════════════════════════════════════════════════════════
const getDraft = async (req, res) => {
  const doc = await getDoc();

  const featuredPizzas = await Pizza.find({
    _id: { $in: doc.draft.featuredPizzas },
  })
    .populate("category", "name emoji")
    .lean();

  const orderedFeatured = doc.draft.featuredPizzas
    .map((id) => featuredPizzas.find((p) => p._id.toString() === id.toString()))
    .filter(Boolean)
    .map((p) => ({ ...p, sizes: p.sizes.map((s) => ({ ...s, price: Math.round(s.priceP / 100) })) }));

  res.json({
    draft: {
      ...doc.draft.toObject(),
      featuredPizzas: orderedFeatured,
    },
    lastPublishedAt: doc.lastPublishedAt,
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN — POST /api/storefront/publish
// Copies draft → published atomically
// ═══════════════════════════════════════════════════════════════════════════════
const publish = async (req, res) => {
  const doc = await getDoc();
  doc.published        = doc.draft.toObject();
  doc.lastPublishedAt  = new Date();
  doc.lastPublishedBy  = req.user._id;
  await doc.save();
  res.json({ message: "Storefront published successfully", lastPublishedAt: doc.lastPublishedAt });
};

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN — POST /api/storefront/discard
// Resets draft back to the current published state
// ═══════════════════════════════════════════════════════════════════════════════
const discardDraft = async (req, res) => {
  const doc = await getDoc();
  doc.draft = doc.published.toObject();
  await doc.save();
  res.json({ message: "Draft discarded — reset to published state" });
};

// ═══════════════════════════════════════════════════════════════════════════════
// BANNERS
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/storefront/banners
const createBanner = async (req, res) => {
  const { heading, description, image, ctaLabel, ctaUrl, isActive, order, startDate, endDate } = req.body;
  if (!heading?.trim()) return res.status(400).json({ message: "Heading is required" });
  if (ctaUrl && !/^https?:\/\/.+/.test(ctaUrl) && !ctaUrl.startsWith("/"))
    return res.status(400).json({ message: "CTA URL must be a valid URL or relative path" });
  const imgErr = validateImage(image);
  if (imgErr) return res.status(400).json({ message: imgErr });

  const doc = await getDoc();
  doc.draft.banners.push({ heading, description, image, ctaLabel, ctaUrl, isActive: isActive !== false, order: order || doc.draft.banners.length, startDate, endDate });
  await doc.save();
  res.status(201).json({ banner: doc.draft.banners[doc.draft.banners.length - 1] });
};

// PUT /api/storefront/banners/:bannerId
const updateBanner = async (req, res) => {
  const doc = await getDoc();
  const banner = doc.draft.banners.id(req.params.bannerId);
  if (!banner) return res.status(404).json({ message: "Banner not found" });

  const { heading, description, image, ctaLabel, ctaUrl, isActive, order, startDate, endDate } = req.body;
  if (ctaUrl && !/^https?:\/\/.+/.test(ctaUrl) && !ctaUrl.startsWith("/"))
    return res.status(400).json({ message: "CTA URL must be a valid URL or relative path" });
  if (image !== undefined) {
    const imgErr = validateImage(image);
    if (imgErr) return res.status(400).json({ message: imgErr });
  }

  if (heading !== undefined)     banner.heading     = heading;
  if (description !== undefined) banner.description = description;
  if (image !== undefined)       banner.image       = image;
  if (ctaLabel !== undefined)    banner.ctaLabel    = ctaLabel;
  if (ctaUrl !== undefined)      banner.ctaUrl      = ctaUrl;
  if (isActive !== undefined)    banner.isActive    = isActive;
  if (order !== undefined)       banner.order       = order;
  if (startDate !== undefined)   banner.startDate   = startDate || null;
  if (endDate !== undefined)     banner.endDate     = endDate || null;

  await doc.save();
  res.json({ banner });
};

// DELETE /api/storefront/banners/:bannerId
const deleteBanner = async (req, res) => {
  const doc = await getDoc();
  const banner = doc.draft.banners.id(req.params.bannerId);
  if (!banner) return res.status(404).json({ message: "Banner not found" });
  banner.deleteOne();
  await doc.save();
  res.json({ message: "Banner deleted" });
};

// PUT /api/storefront/banners/reorder  — body: { order: ["id1","id2",...] }
const reorderBanners = async (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order)) return res.status(400).json({ message: "order must be an array of banner IDs" });
  const doc = await getDoc();
  order.forEach((id, idx) => {
    const b = doc.draft.banners.id(id);
    if (b) b.order = idx;
  });
  await doc.save();
  res.json({ message: "Banners reordered" });
};

// ═══════════════════════════════════════════════════════════════════════════════
// FEATURED PIZZAS
// ═══════════════════════════════════════════════════════════════════════════════

// PUT /api/storefront/featured  — body: { pizzaIds: ["id1","id2",...] }
const setFeaturedPizzas = async (req, res) => {
  const { pizzaIds } = req.body;
  if (!Array.isArray(pizzaIds)) return res.status(400).json({ message: "pizzaIds must be an array" });

  // Validate all IDs exist
  const count = await Pizza.countDocuments({ _id: { $in: pizzaIds } });
  if (count !== pizzaIds.length) return res.status(400).json({ message: "One or more pizza IDs are invalid" });

  const doc = await getDoc();
  doc.draft.featuredPizzas = pizzaIds;
  await doc.save();
  res.json({ message: "Featured pizzas updated", featuredPizzas: pizzaIds });
};

// ═══════════════════════════════════════════════════════════════════════════════
// PROMOTIONS
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/storefront/promotions
const createPromotion = async (req, res) => {
  const { title, description, discountType, discountValue, promoCode, minOrderAmount, startDate, endDate, isActive } = req.body;
  if (!title?.trim())    return res.status(400).json({ message: "Title is required" });
  if (!discountType)     return res.status(400).json({ message: "discountType is required" });
  if (!["percentage", "fixed"].includes(discountType))
    return res.status(400).json({ message: "discountType must be 'percentage' or 'fixed'" });
  if (discountValue === undefined || discountValue < 0)
    return res.status(400).json({ message: "discountValue must be >= 0" });
  if (discountType === "percentage" && discountValue > 100)
    return res.status(400).json({ message: "Percentage discount cannot exceed 100" });

  const doc = await getDoc();
  doc.draft.promotions.push({ title, description, discountType, discountValue, promoCode, minOrderAmount: minOrderAmount || 0, startDate, endDate, isActive: isActive !== false });
  await doc.save();
  res.status(201).json({ promotion: doc.draft.promotions[doc.draft.promotions.length - 1] });
};

// PUT /api/storefront/promotions/:promoId
const updatePromotion = async (req, res) => {
  const doc = await getDoc();
  const promo = doc.draft.promotions.id(req.params.promoId);
  if (!promo) return res.status(404).json({ message: "Promotion not found" });

  const { title, description, discountType, discountValue, promoCode, minOrderAmount, startDate, endDate, isActive } = req.body;
  if (discountType && !["percentage", "fixed"].includes(discountType))
    return res.status(400).json({ message: "discountType must be 'percentage' or 'fixed'" });
  if (discountType === "percentage" && discountValue > 100)
    return res.status(400).json({ message: "Percentage discount cannot exceed 100" });

  if (title !== undefined)          promo.title          = title;
  if (description !== undefined)    promo.description    = description;
  if (discountType !== undefined)   promo.discountType   = discountType;
  if (discountValue !== undefined)  promo.discountValue  = discountValue;
  if (promoCode !== undefined)      promo.promoCode      = promoCode;
  if (minOrderAmount !== undefined) promo.minOrderAmount = minOrderAmount;
  if (startDate !== undefined)      promo.startDate      = startDate || null;
  if (endDate !== undefined)        promo.endDate        = endDate || null;
  if (isActive !== undefined)       promo.isActive       = isActive;

  await doc.save();
  res.json({ promotion: promo });
};

// DELETE /api/storefront/promotions/:promoId
const deletePromotion = async (req, res) => {
  const doc = await getDoc();
  const promo = doc.draft.promotions.id(req.params.promoId);
  if (!promo) return res.status(404).json({ message: "Promotion not found" });
  promo.deleteOne();
  await doc.save();
  res.json({ message: "Promotion deleted" });
};

// ═══════════════════════════════════════════════════════════════════════════════
// ANNOUNCEMENT
// ═══════════════════════════════════════════════════════════════════════════════

// PUT /api/storefront/announcement
const updateAnnouncement = async (req, res) => {
  const { text, isActive, style, startDate, endDate } = req.body;
  if (text !== undefined && text.length > 200)
    return res.status(400).json({ message: "Announcement text must be 200 characters or fewer" });

  const doc = await getDoc();
  if (!doc.draft.announcement) doc.draft.announcement = {};
  if (text !== undefined)      doc.draft.announcement.text      = text;
  if (isActive !== undefined)  doc.draft.announcement.isActive  = isActive;
  if (style !== undefined)     doc.draft.announcement.style     = style;
  if (startDate !== undefined) doc.draft.announcement.startDate = startDate || null;
  if (endDate !== undefined)   doc.draft.announcement.endDate   = endDate || null;

  doc.markModified("draft.announcement");
  await doc.save();
  res.json({ announcement: doc.draft.announcement });
};

// ═══════════════════════════════════════════════════════════════════════════════
// SECTIONS
// ═══════════════════════════════════════════════════════════════════════════════

// PUT /api/storefront/sections
const updateSections = async (req, res) => {
  const { sections } = req.body;
  if (!Array.isArray(sections)) return res.status(400).json({ message: "sections must be an array" });

  const doc = await getDoc();
  doc.draft.sections = sections;
  doc.markModified("draft.sections");
  await doc.save();
  res.json({ sections: doc.draft.sections });
};

// ═══════════════════════════════════════════════════════════════════════════════
// PROMO CODE VALIDATION — called by checkout
// POST /api/storefront/validate-promo
// Body: { promoCode, orderTotal }  (orderTotal in rupees)
// ═══════════════════════════════════════════════════════════════════════════════
const validatePromoCode = async (req, res) => {
  const { promoCode, orderTotal } = req.body;
  if (!promoCode) return res.status(400).json({ message: "promoCode is required" });

  const doc = await getDoc();
  const promo = doc.published.promotions.find(
    (p) => p.promoCode?.toUpperCase() === promoCode.toUpperCase().trim()
  );

  if (!promo || !isPromoValid(promo))
    return res.status(404).json({ message: "Invalid or expired promo code" });

  if (promo.minOrderAmount > 0 && orderTotal < promo.minOrderAmount)
    return res.status(400).json({
      message: `Minimum order amount of ₹${promo.minOrderAmount} required for this code`,
    });

  const discount = promo.discountType === "percentage"
    ? Math.round(orderTotal * promo.discountValue / 100)
    : Math.min(promo.discountValue, orderTotal);

  res.json({
    valid:         true,
    promoId:       promo._id,
    title:         promo.title,
    discountType:  promo.discountType,
    discountValue: promo.discountValue,
    discount,                          // rupees saved
    finalTotal:    orderTotal - discount,
  });
};

module.exports = {
  getPublished, getDraft, publish, discardDraft,
  createBanner, updateBanner, deleteBanner, reorderBanners,
  setFeaturedPizzas,
  createPromotion, updatePromotion, deletePromotion,
  updateAnnouncement,
  updateSections,
  validatePromoCode,
};
