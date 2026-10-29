const mongoose = require("mongoose");

const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "preparing",
  "out_for_delivery",
  "delivered",
  "cancelled",
];

// ── Custom pizza sub-document (builder orders) ────────────────────────────────
const customPizzaSchema = new mongoose.Schema(
  {
    base:    { type: mongoose.Schema.Types.ObjectId, ref: "Inventory", required: true },
    sauce:   { type: mongoose.Schema.Types.ObjectId, ref: "Inventory", required: true },
    cheese:  { type: mongoose.Schema.Types.ObjectId, ref: "Inventory", required: true },
    veggies: [{ type: mongoose.Schema.Types.ObjectId, ref: "Inventory" }],
    // Snapshot names so the order record is self-contained even if inventory changes
    baseName:   { type: String },
    sauceName:  { type: String },
    cheeseName: { type: String },
    veggieNames: [{ type: String }],
  },
  { _id: false }
);

// ── Order item sub-document ───────────────────────────────────────────────────
// itemType "menu"   → pizza ref + size
// itemType "custom" → customPizza sub-doc + size
const orderItemSchema = new mongoose.Schema(
  {
    itemType:    { type: String, enum: ["menu", "custom"], default: "menu" },
    // Menu pizza fields
    pizza:       { type: mongoose.Schema.Types.ObjectId, ref: "Pizza" },
    name:        { type: String, required: true },   // snapshot
    size:        { type: String, enum: ["Small", "Medium", "Large"], required: true },
    priceP:      { type: Number, required: true, min: 0 },  // paise — server-calculated
    quantity:    { type: Number, required: true, min: 1 },
    toppings:    [{ type: String }],
    // Custom pizza fields
    customPizza: { type: customPizzaSchema },
  },
  { _id: false }
);

// Virtual for display
orderItemSchema.virtual("price").get(function () {
  return Math.round(this.priceP / 100);
});

// ── Status history ────────────────────────────────────────────────────────────
const statusHistorySchema = new mongoose.Schema(
  {
    status:    { type: String, required: true },
    changedAt: { type: Date, default: Date.now },
    note:      { type: String },
  },
  { _id: false }
);

// ── Order ─────────────────────────────────────────────────────────────────────
const orderSchema = new mongoose.Schema(
  {
    user:    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    items:   { type: [orderItemSchema], required: true, validate: [(v) => v.length > 0, "Order must have at least one item"] },

    deliveryAddress: {
      street:  { type: String, required: true },
      city:    { type: String, required: true },
      state:   { type: String, required: true },
      pincode: { type: String, required: true },
    },

    // All monetary values in PAISE
    subtotalP:    { type: Number, required: true, min: 0 },
    deliveryFeeP: { type: Number, default: 4000 },   // ₹40 = 4000 paise
    totalP:       { type: Number, required: true, min: 0 },

    status:        { type: String, enum: ORDER_STATUSES, default: "pending", index: true },
    statusHistory: { type: [statusHistorySchema], default: [] },

    payment: {
      method:              { type: String, enum: ["razorpay", "cod"], default: "cod" },
      status:              { type: String, enum: ["pending", "paid", "failed", "refunded"], default: "pending" },
      razorpayOrderId:     { type: String, index: true },
      razorpayPaymentId:   { type: String, index: true, sparse: true },
      razorpaySignature:   { type: String },   // stored for idempotency audit
      paidAt:              { type: Date },
    },

    estimatedDelivery: { type: Date },
    notes:             { type: String, trim: true },

    // Idempotency flags for inventory lifecycle.
    // stockReserved: set when order is placed (pre-payment hold).
    // stockDeducted: set when payment is confirmed (physical deduction).
    // Prevents double-deduction from duplicate payment callbacks / webhooks.
    stockReserved: { type: Boolean, default: false },
    stockDeducted: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true,
    toJSON:     { virtuals: true },
    toObject:   { virtuals: true },
  }
);

// ── Virtuals (rupee display) ──────────────────────────────────────────────────
orderSchema.virtual("subtotal").get(function () { return Math.round(this.subtotalP / 100); });
orderSchema.virtual("deliveryFee").get(function () { return Math.round(this.deliveryFeeP / 100); });
orderSchema.virtual("total").get(function () { return Math.round(this.totalP / 100); });

// ── Indexes ───────────────────────────────────────────────────────────────────
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ "payment.status": 1 });
orderSchema.index({ createdAt: -1 });

// ── Hooks ─────────────────────────────────────────────────────────────────────
orderSchema.pre("save", function () {
  if (this.isModified("status")) {
    this.statusHistory.push({ status: this.status });
  }
});

module.exports = mongoose.model("Order", orderSchema);
module.exports.ORDER_STATUSES = ORDER_STATUSES;
