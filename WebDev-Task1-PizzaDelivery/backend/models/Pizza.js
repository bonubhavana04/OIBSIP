const mongoose = require("mongoose");

// Prices are stored in PAISE (integer) to avoid floating-point rounding.
// Display layer divides by 100.  e.g. ₹199 → 19900 paise.
// NOTE: existing seed data uses rupee integers (199, 299 …).
// The seedMenu.js script multiplies by 100 before inserting.
const sizeSchema = new mongoose.Schema(
  {
    label:    { type: String, enum: ["Small", "Medium", "Large"], required: true },
    priceP:   { type: Number, required: true, min: 0 },   // paise
  },
  { _id: false }
);

// Virtual so existing code that reads `.price` still works during transition
sizeSchema.virtual("price").get(function () {
  return Math.round(this.priceP / 100);
});

const pizzaSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    category:    { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    image:       { type: String },
    sizes:       { type: [sizeSchema], required: true, validate: [(v) => v.length > 0, "At least one size required"] },
    toppings:    [{ type: String, trim: true }],
    isVeg:       { type: Boolean, default: true },
    isAvailable: { type: Boolean, default: true },
    isFeatured:  { type: Boolean, default: false },
    ratings: {
      average: { type: Number, default: 0, min: 0, max: 5 },
      count:   { type: Number, default: 0, min: 0 },
    },
  },
  {
    timestamps: true,
    toJSON:     { virtuals: true },
    toObject:   { virtuals: true },
  }
);

// ── Indexes ──────────────────────────────────────────────────────────────────
pizzaSchema.index({ name: "text", description: "text" });
pizzaSchema.index({ category: 1, isAvailable: 1 });
pizzaSchema.index({ isFeatured: 1, isAvailable: 1 });
pizzaSchema.index({ isVeg: 1, isAvailable: 1 });

module.exports = mongoose.model("Pizza", pizzaSchema);
