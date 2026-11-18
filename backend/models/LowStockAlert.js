const mongoose = require("mongoose");

/**
 * LowStockAlert — one document per inventory item that is *currently* in a
 * low-stock alert state.
 *
 * Lifecycle:
 *   • INSERT (upsert) when stock first drops below threshold  → alert sent
 *   • Document stays alive while stock remains low            → alert suppressed
 *   • DELETE when stock is restocked above threshold          → next dip fires a fresh alert
 *
 * The unique index on `item` acts as a distributed lock: whichever app instance
 * wins the upsert sends the email; all others get a duplicate-key error and skip.
 */
const schema = new mongoose.Schema(
  {
    item:         { type: mongoose.Schema.Types.ObjectId, ref: "Inventory", required: true, unique: true },
    stockAtAlert: { type: Number, required: true },
    alertedAt:    { type: Date,   default: Date.now },
  },
  { timestamps: false }
);

module.exports = mongoose.model("LowStockAlert", schema);
