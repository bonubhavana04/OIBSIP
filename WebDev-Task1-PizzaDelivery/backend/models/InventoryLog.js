const mongoose = require("mongoose");

/**
 * InventoryLog — immutable audit trail for every stock change.
 *
 * delta > 0  → stock added   (restock, cancellation refund)
 * delta < 0  → stock removed (deduction, manual adjustment)
 * delta = 0  → metadata-only change (availability toggle)
 */
const inventoryLogSchema = new mongoose.Schema(
  {
    ingredient: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Inventory",
      required: true,
      index:    true,
    },
    ingredientName: { type: String, required: true },   // snapshot — survives deletion
    delta:          { type: Number, required: true },   // signed change in units
    stockBefore:    { type: Number, required: true },
    stockAfter:     { type: Number, required: true },
    reason: {
      type:     String,
      required: true,
      enum: [
        "order_deduction",    // stock removed after payment confirmed
        "order_cancellation", // stock returned after order cancelled
        "manual_adjustment",  // admin set/adjusted quantity
        "restock",            // admin added stock
        "payment_failure",    // stock returned after payment failed
      ],
    },
    order:     { type: mongoose.Schema.Types.ObjectId, ref: "Order",  index: true },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    note:      { type: String, trim: true },
  },
  {
    timestamps: true,
    // Logs are append-only — disable update operations at schema level
    // (enforced by never calling .save() on existing docs)
  }
);

inventoryLogSchema.index({ ingredient: 1, createdAt: -1 });
inventoryLogSchema.index({ order: 1 });

module.exports = mongoose.model("InventoryLog", inventoryLogSchema);
