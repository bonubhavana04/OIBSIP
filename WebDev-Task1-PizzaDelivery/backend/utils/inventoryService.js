/**
 * inventoryService.js
 *
 * All stock mutations go through this module.  Every function that changes
 * stock writes an InventoryLog entry in the same operation so the audit trail
 * is always consistent.
 *
 * MongoDB transactions are used when the connection is part of a replica set.
 * When running against a standalone mongod (common in development) the code
 * falls back to a safe sequential approach that is still idempotent because
 * every deduction is guarded by the Order.stockDeducted flag.
 */

const mongoose    = require("mongoose");
const Inventory   = require("../models/Inventory");
const InventoryLog = require("../models/InventoryLog");
const PizzaIngredient = require("../models/PizzaIngredient");

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a Map<ingredientId, totalQty> from an order's items.
 * Handles both menu pizzas (via PizzaIngredient) and custom builder pizzas.
 */
const buildIngredientMap = async (orderItems) => {
  const counts = new Map(); // id (string) → qty

  const add = (id, qty) => {
    const key = id.toString();
    counts.set(key, (counts.get(key) || 0) + qty);
  };

  for (const item of orderItems) {
    const qty = item.quantity;

    if (item.itemType === "custom" && item.customPizza) {
      const cp = item.customPizza;
      if (cp.base)   add(cp.base,   qty);
      if (cp.sauce)  add(cp.sauce,  qty);
      if (cp.cheese) add(cp.cheese, qty);
      for (const v of cp.veggies || []) add(v, qty);
    } else if (item.itemType === "menu" && item.pizza) {
      // Look up the ingredient recipe for this menu pizza
      const recipe = await PizzaIngredient.find({ pizza: item.pizza });
      for (const r of recipe) {
        add(r.ingredient, r.qty * qty);
      }
    }
  }

  return counts;
};

/**
 * Write a single InventoryLog entry inside an optional session.
 */
const writeLog = (ingredient, delta, stockBefore, stockAfter, reason, extras = {}, session) => {
  const doc = {
    ingredient:     ingredient._id,
    ingredientName: ingredient.name,
    delta,
    stockBefore,
    stockAfter,
    reason,
    ...extras,
  };
  return session
    ? InventoryLog.create([doc], { session })
    : InventoryLog.create(doc);
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * validateStock — read-only check.
 * Returns { ok: true } or { ok: false, shortfalls: [{ name, need, available }] }
 * Does NOT modify any document.
 */
const validateStock = async (orderItems) => {
  const counts = await buildIngredientMap(orderItems);
  if (counts.size === 0) return { ok: true, shortfalls: [] };

  const ids  = [...counts.keys()];
  const docs = await Inventory.find({ _id: { $in: ids } });

  const shortfalls = [];
  for (const doc of docs) {
    if (doc.stock === -1) continue; // unlimited
    const need      = counts.get(doc._id.toString()) || 0;
    const available = Math.max(0, doc.stock - doc.reservedStock);
    if (available < need) {
      shortfalls.push({ name: doc.name, need, available });
    }
  }

  return { ok: shortfalls.length === 0, shortfalls };
};

/**
 * reserveStock — atomically increments reservedStock for each ingredient.
 * Uses findOneAndUpdate with an $expr guard so the check-and-increment is
 * a single atomic operation — prevents TOCTOU races between concurrent orders.
 * Throws with a user-friendly message if any ingredient is short.
 */
const reserveStock = async (orderItems, orderId) => {
  const counts = await buildIngredientMap(orderItems);
  if (counts.size === 0) return;

  const ids  = [...counts.keys()];
  const docs = await Inventory.find({ _id: { $in: ids } });

  // Build a name map for error messages
  const nameMap = new Map(docs.map((d) => [d._id.toString(), d.name]));

  const reserved = []; // track successful increments for rollback

  try {
    for (const [id, qty] of counts) {
      const doc = docs.find((d) => d._id.toString() === id);
      if (!doc || doc.stock === -1) continue; // unlimited — skip

      // Atomic: only increment if (stock - reservedStock) >= qty
      const updated = await Inventory.findOneAndUpdate(
        {
          _id: id,
          stock: { $ne: -1 },
          $expr: { $gte: [{ $subtract: ["$stock", "$reservedStock"] }, qty] },
        },
        { $inc: { reservedStock: qty } },
        { new: true }
      );

      if (!updated) {
        // Re-read to get current available for the error message
        const fresh = await Inventory.findById(id);
        const available = fresh ? Math.max(0, fresh.stock - fresh.reservedStock) : 0;
        const name = nameMap.get(id) || id;
        throw Object.assign(
          new Error(
            `Insufficient stock: "${name}" (need ${qty}, available ${available}). ` +
            `Please remove those items from your cart.`
          ),
          { status: 409, shortfalls: [`"${name}" (need ${qty}, available ${available})`] }
        );
      }

      reserved.push({ id, qty });
    }
  } catch (err) {
    // Roll back any reservations already made in this call
    for (const { id, qty } of reserved) {
      await Inventory.findByIdAndUpdate(id, { $inc: { reservedStock: -qty } })
        .catch((e) => console.error(`Reservation rollback failed for ${id}:`, e.message));
    }
    throw err;
  }
};

/**
 * releaseReservation — decrements reservedStock (undoes reserveStock).
 * Called when an order is cancelled or payment fails.
 * Idempotent: clamps reservedStock at 0.
 */
const releaseReservation = async (orderItems, orderId, performedBy, reason) => {
  const counts = await buildIngredientMap(orderItems);
  if (counts.size === 0) return;

  const ids  = [...counts.keys()];
  const docs = await Inventory.find({ _id: { $in: ids } });

  for (const doc of docs) {
    if (doc.stock === -1) continue;
    const qty = counts.get(doc._id.toString()) || 0;
    // Clamp: never let reservedStock go below 0
    const release = Math.min(qty, doc.reservedStock);
    if (release <= 0) continue;

    await Inventory.findByIdAndUpdate(doc._id, { $inc: { reservedStock: -release } });
  }
};

/**
 * deductStock — atomically deducts physical stock and releases the reservation.
 * Uses a MongoDB transaction when the connection supports it (replica set).
 * Falls back to sequential atomic findOneAndUpdate ops on standalone mongod.
 *
 * Idempotency: the caller MUST set order.stockDeducted = true in the same
 * transaction / operation so duplicate calls are blocked at the order level.
 *
 * Returns an array of InventoryLog documents created.
 */
const deductStock = async (orderItems, orderId, performedBy) => {
  const counts = await buildIngredientMap(orderItems);
  if (counts.size === 0) return [];

  const ids  = [...counts.keys()];
  const docs = await Inventory.find({ _id: { $in: ids } });

  // Check if the connection is part of a replica set (transactions require it)
  const supportsTransactions =
    mongoose.connection.readyState === 1 &&
    mongoose.connection.db?.serverConfig?.isReplicaSet?.() === true;

  if (supportsTransactions) {
    return _deductWithTransaction(docs, counts, orderId, performedBy);
  }
  return _deductSequential(docs, counts, orderId, performedBy);
};

/**
 * Transaction-based deduction (replica set / Atlas).
 * All deductions succeed or all roll back — no partial state.
 */
const _deductWithTransaction = async (docs, counts, orderId, performedBy) => {
  const session = await mongoose.startSession();
  const logs    = [];

  try {
    await session.withTransaction(async () => {
      for (const doc of docs) {
        if (doc.stock === -1) continue;
        const qty = counts.get(doc._id.toString()) || 0;

        // Atomic: only update if stock is still sufficient
        const updated = await Inventory.findOneAndUpdate(
          { _id: doc._id, stock: { $gte: qty } },
          {
            $inc: { stock: -qty, reservedStock: -Math.min(qty, doc.reservedStock) },
          },
          { new: true, session }
        );

        if (!updated) {
          throw Object.assign(
            new Error(`Concurrent stock conflict for "${doc.name}" — transaction will retry`),
            { status: 409 }
          );
        }

        const logDocs = await writeLog(
          doc, -qty, doc.stock, updated.stock,
          "order_deduction",
          { order: orderId, performedBy },
          session
        );
        logs.push(...(Array.isArray(logDocs) ? logDocs : [logDocs]));
      }
    });
  } finally {
    await session.endSession();
  }

  return logs;
};

/**
 * Sequential deduction (standalone mongod — no transactions).
 * Each update is atomic at the document level via the $gte guard.
 * If any update fails the guard, we attempt to roll back already-deducted items.
 */
const _deductSequential = async (docs, counts, orderId, performedBy) => {
  const deducted = []; // track what we've already decremented for rollback
  const logs     = [];

  try {
    for (const doc of docs) {
      if (doc.stock === -1) continue;
      const qty = counts.get(doc._id.toString()) || 0;

      const updated = await Inventory.findOneAndUpdate(
        { _id: doc._id, stock: { $gte: qty } },
        {
          $inc: {
            stock:         -qty,
            reservedStock: -Math.min(qty, doc.reservedStock),
          },
        },
        { new: true }
      );

      if (!updated) {
        // Race condition — another order consumed the stock between validate and deduct
        throw Object.assign(
          new Error(
            `Stock for "${doc.name}" was consumed by a concurrent order. ` +
            `Please try again.`
          ),
          { status: 409 }
        );
      }

      deducted.push({ doc, qty });

      const log = await writeLog(
        doc, -qty, doc.stock, updated.stock,
        "order_deduction",
        { order: orderId, performedBy }
      );
      logs.push(log);
    }
  } catch (err) {
    // Compensating transaction: restore already-deducted items
    for (const { doc, qty } of deducted) {
      await Inventory.findByIdAndUpdate(doc._id, {
        $inc: { stock: qty, reservedStock: qty },
      }).catch((e) => console.error(`Rollback failed for ${doc.name}:`, e.message));
    }
    throw err;
  }

  return logs;
};

/**
 * restoreStock — returns stock after cancellation or payment failure.
 * Writes an audit log entry for each restored ingredient.
 */
const restoreStock = async (orderItems, orderId, performedBy, reason) => {
  const counts = await buildIngredientMap(orderItems);
  if (counts.size === 0) return;

  const ids  = [...counts.keys()];
  const docs = await Inventory.find({ _id: { $in: ids } });

  for (const doc of docs) {
    if (doc.stock === -1) continue;
    const qty = counts.get(doc._id.toString()) || 0;

    const updated = await Inventory.findByIdAndUpdate(
      doc._id,
      { $inc: { stock: qty } },
      { new: true }
    );

    await writeLog(
      doc, qty, doc.stock, updated.stock,
      reason,
      { order: orderId, performedBy }
    );
  }
};

/**
 * adjustStock — admin manual adjustment (set absolute quantity).
 * Writes an audit log entry.
 */
const adjustStock = async (ingredientId, newStock, performedBy, note) => {
  if (!Number.isInteger(newStock) || newStock < -1) {
    throw Object.assign(new Error("stock must be an integer >= -1 (use -1 for unlimited)"), { status: 400 });
  }

  const doc = await Inventory.findById(ingredientId);
  if (!doc) throw Object.assign(new Error("Inventory item not found"), { status: 404 });

  const before = doc.stock;
  doc.stock = newStock;
  await doc.save();

  await writeLog(
    doc, newStock - before, before, newStock,
    "manual_adjustment",
    { performedBy, note }
  );

  return doc;
};

/**
 * addStock — admin restock (increment).
 * Writes an audit log entry.
 */
const addStock = async (ingredientId, qty, performedBy, note) => {
  if (!Number.isInteger(qty) || qty <= 0) {
    throw Object.assign(new Error("qty must be a positive integer"), { status: 400 });
  }

  const doc = await Inventory.findById(ingredientId);
  if (!doc) throw Object.assign(new Error("Inventory item not found"), { status: 404 });

  const before  = doc.stock;
  const updated = doc.stock === -1
    ? doc  // unlimited — no change to stock number
    : await Inventory.findByIdAndUpdate(doc._id, { $inc: { stock: qty } }, { new: true });

  if (doc.stock !== -1) {
    await writeLog(
      doc, qty, before, updated.stock,
      "restock",
      { performedBy, note }
    );
  }

  return updated;
};

module.exports = {
  validateStock,
  reserveStock,
  releaseReservation,
  deductStock,
  restoreStock,
  adjustStock,
  addStock,
  buildIngredientMap,
};
