const mongoose = require("mongoose");

// ── Banner sub-document ───────────────────────────────────────────────────────
const bannerSchema = new mongoose.Schema(
  {
    heading:     { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 300 },
    image:       { type: String, trim: true },          // URL or data-URI
    ctaLabel:    { type: String, trim: true, maxlength: 60 },
    ctaUrl:      { type: String, trim: true, maxlength: 500 },
    isActive:    { type: Boolean, default: true },
    order:       { type: Number, default: 0 },
    startDate:   { type: Date },
    endDate:     { type: Date },
  },
  { timestamps: true }
);

// ── Promotion sub-document ────────────────────────────────────────────────────
const promotionSchema = new mongoose.Schema(
  {
    title:          { type: String, required: true, trim: true, maxlength: 120 },
    description:    { type: String, trim: true, maxlength: 400 },
    discountType:   { type: String, enum: ["percentage", "fixed"], required: true },
    discountValue:  { type: Number, required: true, min: 0 },
    promoCode:      { type: String, trim: true, uppercase: true, maxlength: 30 },
    minOrderAmount: { type: Number, default: 0, min: 0 },  // rupees
    startDate:      { type: Date },
    endDate:        { type: Date },
    isActive:       { type: Boolean, default: true },
  },
  { timestamps: true }
);

// ── Homepage section sub-document ─────────────────────────────────────────────
const sectionSchema = new mongoose.Schema(
  {
    key:       { type: String, required: true },   // e.g. "hero", "featured", "features"
    label:     { type: String, required: true },
    isVisible: { type: Boolean, default: true },
    order:     { type: Number, default: 0 },
    heading:   { type: String, trim: true, maxlength: 120 },
    subheading:{ type: String, trim: true, maxlength: 300 },
  },
  { _id: false }
);

// ── Announcement sub-document ─────────────────────────────────────────────────
const announcementSchema = new mongoose.Schema(
  {
    text:      { type: String, trim: true, maxlength: 200 },
    isActive:  { type: Boolean, default: false },
    style:     { type: String, enum: ["info", "promo", "warning"], default: "promo" },
    startDate: { type: Date },
    endDate:   { type: Date },
  },
  { _id: false }
);

// ── Root storefront config ────────────────────────────────────────────────────
// Single document per environment — use findOneAndUpdate with upsert.
const storefrontSchema = new mongoose.Schema(
  {
    // Draft state — what the admin is currently editing
    draft: {
      banners:        { type: [bannerSchema], default: [] },
      featuredPizzas: [{ type: mongoose.Schema.Types.ObjectId, ref: "Pizza" }],
      promotions:     { type: [promotionSchema], default: [] },
      announcement:   { type: announcementSchema, default: () => ({}) },
      sections:       { type: [sectionSchema], default: () => defaultSections() },
    },

    // Published state — what customers see
    published: {
      banners:        { type: [bannerSchema], default: [] },
      featuredPizzas: [{ type: mongoose.Schema.Types.ObjectId, ref: "Pizza" }],
      promotions:     { type: [promotionSchema], default: [] },
      announcement:   { type: announcementSchema, default: () => ({}) },
      sections:       { type: [sectionSchema], default: () => defaultSections() },
    },

    lastPublishedAt: { type: Date },
    lastPublishedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

function defaultSections() {
  return [
    { key: "hero",       label: "Hero Banner",        isVisible: true,  order: 0 },
    { key: "featured",   label: "Featured Pizzas",    isVisible: true,  order: 1 },
    { key: "builder",    label: "Build Your Pizza",   isVisible: true,  order: 2 },
    { key: "features",   label: "Why Choose Us",      isVisible: true,  order: 3 },
    { key: "categories", label: "Popular Categories", isVisible: false, order: 4 },
  ];
}

module.exports = mongoose.model("Storefront", storefrontSchema);
module.exports.defaultSections = defaultSections;
