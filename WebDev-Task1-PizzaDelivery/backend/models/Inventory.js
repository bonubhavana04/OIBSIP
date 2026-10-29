const mongoose = require("mongoose");

/**
 * Inventory — tracks builder ingredients.
 *
 * category: "base" | "sauce" | "cheese" | "veggie"
 * priceP:   surcharge in PAISE on top of the base pizza price (0 = included)
 * stock:    units in stock (-1 = unlimited / not tracked)
 * lowStockThreshold: alert when stock falls at or below this value
 */
const inventorySchema = new mongoose.Schema(
  {
    category: {
      type:     String,
      required: true,
      enum:     ["base", "sauce", "cheese", "veggie"],
      index:    true,
    },
    name:        { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    emoji:       { type: String, default: "🍕" },
    priceP:      { type: Number, required: true, min: 0, default: 0 },  // paise
    stock:         { type: Number, default: -1 },   // -1 = unlimited
    reservedStock: { type: Number, default: 0, min: 0 }, // held for pending payments
    lowStockThreshold: { type: Number, default: 10 },
    isAvailable: { type: Boolean, default: true, index: true },
    sortOrder:   { type: Number, default: 0 },    // display ordering
  },
  { timestamps: true }
);

// ── Indexes ──────────────────────────────────────────────────────────────────
inventorySchema.index({ category: 1, isAvailable: 1, sortOrder: 1 });
inventorySchema.index({ name: 1, category: 1 }, { unique: true });

// ── Virtuals ─────────────────────────────────────────────────────────────────
inventorySchema.virtual("price").get(function () {
  return Math.round(this.priceP / 100);   // rupees for display
});

// ── Instance helpers ─────────────────────────────────────────────────────────

/** Returns true if this item can be used (available + in stock) */
inventorySchema.methods.canUse = function () {
  if (!this.isAvailable) return false;
  if (this.stock === -1) return true;
  return this.availableStock > 0;
};

/** Available = physical stock minus what is already reserved for pending payments */
inventorySchema.virtual("availableStock").get(function () {
  if (this.stock === -1) return Infinity;
  return Math.max(0, this.stock - this.reservedStock);
});

/** Deduct `qty` units; throws if insufficient stock */
inventorySchema.methods.deductStock = async function (qty = 1) {
  if (this.stock === -1) return;   // unlimited — nothing to deduct
  if (this.availableStock < qty) throw new Error(`Insufficient stock for "${this.name}"`);
  this.stock -= qty;
  await this.save();
};

// ── Statics ──────────────────────────────────────────────────────────────────

/** Fetch all available items for a given category, sorted by sortOrder */
inventorySchema.statics.available = function (category) {
  return this.find({ category, isAvailable: true }).sort({ sortOrder: 1, name: 1 });
};

/** Validate an array of item IDs all belong to `category` and are available */
inventorySchema.statics.validateItems = async function (ids, category) {
  if (!ids || ids.length === 0) return [];
  const items = await this.find({ _id: { $in: ids }, category, isAvailable: true });
  if (items.length !== ids.length) {
    const found = new Set(items.map((i) => i._id.toString()));
    const missing = ids.filter((id) => !found.has(id.toString()));
    throw new Error(`Invalid or unavailable ${category} item(s): ${missing.join(", ")}`);
  }
  return items;
};

module.exports = mongoose.model("Inventory", inventorySchema);
