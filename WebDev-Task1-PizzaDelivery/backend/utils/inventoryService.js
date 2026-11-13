/**
 * inventoryService.js
 *
 * All stock mutations go through this module. Every function that changes
 * stock writes an InventoryLog entry so the audit trail is always consistent.
 *
 * Atomicity strategy (standalone mongod — no replica set required):
 *   Every mutation uses a single findOneAndUpdate with a filter that encodes
 *   the precondition (e.g. stock >= qty, reservation status === "reserved").
 *   MongoDB guarantees document-level atomicity for a single update, so the
 *   check-and-modify is never split across two operations.
 *
 *   The Order.stockDeducted flag is the idempotency gate for deductions:
 *   confirmPayment / confirmCOD set it atomically via findOneAndUpdate with
 *   { stockDeducted: false } in the filter, so duplicate payment callbacks
 *   or webhooks can never trigger a second deduction.
 *
 * Replica-set / Atlas (transactions):
 *   When the connection is part of a replica set, MongoDB multi-document
 *   transactions are available. The current implementation does NOT use them
 *   because the reservation model already prevents overselling without them:
 *     - reserveStock atomically increments reservedStock (pre-payment hold)
 *     - deductStock atomically converts "reserved" → "deducted" per ingredient
 *     - If any deduction fails, the catch block rolls back already-deducted
 *       items by reversing each findOneAndUpdate individually
 *   This is safe because the Order.stockDeducted flag ensures the entire
 *   deduct-then-flag sequence is attempted at most once per order.
 *
 *   To enable true multi-document transactions in the future, wrap the loop
 *   in deductStock inside a mongoose session (see the commented _withTransaction
 *   pattern at the bottom of this file).
 */

const Inventory      = require("../models/Inventory");
const InventoryLog   = require("../models/InventoryLog");
const PizzaIngredient = require("../models/PizzaIngredient");

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a Map<ingredientId(string), totalQty> from an order's items.
 * Handles both menu pizzas (via PizzaIngredient recipe) and custom builder pizzas.
 */
const buildIngredientMap = async (orderItems) => {
  const counts = new Map();

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
      const recipe = await PizzaIngredient.find({ pizza: item.pizza });
      for (const r of recipe) {
        add(r.ingredient, r.qty * qty);
      }
    }
  }

  return counts;
};

/**
 * Write a single InventoryLog entry.
 * Pass a mongoose session to include the write in a transaction.
 */
const writeLog = (ingredient, delta, stockBefore, stockAfter, reason, extras = {}, session) => {
  const doc = {
    ingredient:     ingredient._id || ingredient,
    ingredientName: ingredient.name || "unknown",
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
 * validateStock — read-only pre-flight check.
 * Returns { ok: true } or { ok: false, shortfalls: [{ name, need, available }] }.
 * Does NOT modify any document.
 */
const validateStock = async (orderItems) => {
  const counts = await buildIngredientMap(orderItems);
  if (counts.size === 0) return { ok: true, shortfalls: [] };

  const ids  = [...counts.keys()];
  const docs = await Inventory.find({ _id: { $in: ids } });

  const shortfalls = [];
  for (const doc of docs) {
    if (doc.stock === -1) continue;
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
 *
 * Uses findOneAndUpdate with an $expr guard so the availability check and
 * the increment are a single atomic operation — prevents TOCTOU races between
 * concurrent orders placing at the same time.
 *
 * Idempotent: if a reservation for this order already exists in "reserved" or
 * "deducted" state with the same quantity, the call is a no-op for that item.
 *
 * Throws with a user-friendly message (and a shortfalls array) if any
 * ingredient has insufficient available stock.
 */
const reserveStock = async (orderItems, orderId) => {
  const counts = await buildIngredientMap(orderItems);
  if (counts.size === 0) return;

  const ids  = [...counts.keys()];
  const docs = await Inventory.find({ _id: { $in: ids } });

  const reservedNow = [];

  try {
    for (const [id, qty] of counts) {
      const doc = docs.find((d) => d._id.toString() === id);

      if (!doc) {
        throw Object.assign(
          new Error(`Inventory item not found: ${id}`),
          { status: 409 }
        );
      }

      if (doc.stock === -1) continue;

      // Idempotency: skip if a valid reservation already exists for this order
      const existing = doc.reservations.find(
        (r) => r.order.toString() === orderId.toString()
      );

      if (existing) {
        if (
          existing.quantity === qty &&
          ["reserved", "deducted"].includes(existing.status)
        ) {
          continue;
        }
        throw Object.assign(
          new Error(`Reservation already exists in state "${existing.status}" for "${doc.name}".`),
          { status: 409 }
        );
      }

      // Atomic check-and-increment: fails if available stock < qty
      const updated = await Inventory.findOneAndUpdate(
        {
          _id: id,
          stock: { $ne: -1 },
          "reservations.order": { $ne: orderId },
          $expr: {
            $gte: [
              { $subtract: ["$stock", { $ifNull: ["$reservedStock", 0] }] },
              qty,
            ],
          },
        },
        {
          $inc:  { reservedStock: qty },
          $push: {
            reservations: { order: orderId, quantity: qty, status: "reserved" },
          },
        },
        { returnDocument: "after" }
      );

      if (!updated) {
        // Re-read to distinguish "race-lost but now idempotent" from "truly out of stock"
        const fresh = await Inventory.findById(id);
        const duplicate = fresh?.reservations.find(
          (r) => r.order.toString() === orderId.toString()
        );

        if (
          duplicate &&
          duplicate.quantity === qty &&
          ["reserved", "deducted"].includes(duplicate.status)
        ) {
          continue;
        }

        const available = fresh
          ? Math.max(0, fresh.stock - (fresh.reservedStock || 0))
          : 0;

        throw Object.assign(
          new Error(
            `Insufficient stock: "${doc.name}" (need ${qty}, available ${available}). ` +
            `Please remove those items from your cart.`
          ),
          {
            status:     409,
            shortfalls: [`"${doc.name}" (need ${qty}, available ${available})`],
          }
        );
      }

      reservedNow.push({ id, qty });
    }
  } catch (err) {
    // Compensating rollback: release every reservation we just created
    for (const { id, qty } of reservedNow) {
      await Inventory.findOneAndUpdate(
        {
          _id: id,
          reservations: {
            $elemMatch: { order: orderId, quantity: qty, status: "reserved" },
          },
        },
        {
          $inc: { reservedStock: -qty },
          $set: { "reservations.$[r].status": "released" },
        },
        {
          returnDocument: "after",
          arrayFilters: [{ "r.order": orderId, "r.quantity": qty, "r.status": "reserved" }],
        }
      ).catch((rollbackErr) => {
        console.error(`Reservation rollback failed for ${id}:`, rollbackErr.message);
      });
    }
    throw err;
  }
};

/**
 * releaseReservation — decrements reservedStock (undoes reserveStock).
 * Called when an order is cancelled before payment, or when payment fails.
 * Idempotent: the $elemMatch filter on status "reserved" means a second call
 * finds no matching document and silently skips.
 */
const releaseReservation = async (orderItems, orderId, performedBy, reason) => {
  const counts = await buildIngredientMap(orderItems);
  if (counts.size === 0) return [];

  const ids  = [...counts.keys()];
  const docs = await Inventory.find({ _id: { $in: ids } });
  const logs = [];

  for (const [id, qty] of counts) {
    const doc = docs.find((d) => d._id.toString() === id);
    if (!doc || doc.stock === -1) continue;

    const updated = await Inventory.findOneAndUpdate(
      {
        _id: id,
        reservedStock: { $gte: qty },
        reservations: {
          $elemMatch: { order: orderId, quantity: qty, status: "reserved" },
        },
      },
      {
        $inc: { reservedStock: -qty },
        $set: { "reservations.$[r].status": "released" },
      },
      {
        returnDocument: "after",
        arrayFilters: [{ "r.order": orderId, "r.quantity": qty, "r.status": "reserved" }],
      }
    );

    if (!updated) continue;

    logs.push(
      await writeLog(
        doc, 0, doc.stock, doc.stock,
        reason || "order_cancellation",
        { order: orderId, performedBy }
      )
    );
  }

  return logs;
};

/**
 * deductStock — atomically converts each ingredient's reservation from
 * "reserved" → "deducted" and decrements physical stock.
 *
 * Idempotency:
 *   - The $elemMatch filter requires status === "reserved". If the reservation
 *     is already "deducted" (duplicate callback), the update finds no document
 *     and the code skips that ingredient silently.
 *   - The caller (confirmPayment / confirmCOD) additionally guards with the
 *     Order.stockDeducted flag so this function is never called twice for the
 *     same order.
 *
 * Rollback:
 *   If any ingredient fails (e.g. stock was manually zeroed after reservation),
 *   the catch block reverses every deduction already applied in this call by
 *   converting "deducted" back to "reserved" and restoring stock. The order
 *   remains in its pre-deduction state so the caller can handle the error.
 *
 * Returns an array of InventoryLog documents created.
 */
const deductStock = async (orderItems, orderId, performedBy) => {
  const counts = await buildIngredientMap(orderItems);
  if (counts.size === 0) return [];

  const ids  = [...counts.keys()];
  const docs = await Inventory.find({ _id: { $in: ids } });

  const deducted = []; // { id, qty } — for rollback
  const logs     = [];

  try {
    for (const [id, qty] of counts) {
      const doc = docs.find((d) => d._id.toString() === id);

      if (!doc) {
        throw Object.assign(
          new Error(`Inventory item not found: ${id}`),
          { status: 409 }
        );
      }

      if (doc.stock === -1) continue;

      const updated = await Inventory.findOneAndUpdate(
        {
          _id: id,
          stock:         { $gte: qty },
          reservedStock: { $gte: qty },
          reservations: {
            $elemMatch: { order: orderId, quantity: qty, status: "reserved" },
          },
        },
        {
          $inc: { stock: -qty, reservedStock: -qty },
          $set: { "reservations.$[r].status": "deducted" },
        },
        {
          returnDocument: "after",
          arrayFilters: [{ "r.order": orderId, "r.quantity": qty, "r.status": "reserved" }],
        }
      );

      if (!updated) {
        // Check whether this ingredient was already deducted (idempotent path)
        const fresh = await Inventory.findById(id);
        const existing = fresh?.reservations.find(
          (r) => r.order.toString() === orderId.toString()
        );

        if (existing?.status === "deducted") continue;

        if (!existing) {
          throw Object.assign(
            new Error(
              `No inventory reservation found for "${doc.name}" and order ${orderId}.`
            ),
            { status: 409 }
          );
        }

        throw Object.assign(
          new Error(
            `Unable to deduct stock for "${doc.name}". ` +
            `Its reservation is in state "${existing.status}".`
          ),
          { status: 409 }
        );
      }

      deducted.push({ id, qty, doc, stockAfter: updated.stock });

      logs.push(
        await writeLog(
          doc, -qty, doc.stock, updated.stock,
          "order_deduction",
          { order: orderId, performedBy }
        )
      );
    }
  } catch (err) {
    // Compensating rollback: restore every deduction applied in this call
    for (const { id, qty, doc: rolledDoc, stockAfter: stockAtDeduction } of deducted.reverse()) {
      const restored = await Inventory.findOneAndUpdate(
        {
          _id: id,
          reservations: {
            $elemMatch: { order: orderId, quantity: qty, status: "deducted" },
          },
        },
        {
          $inc: { stock: qty, reservedStock: qty },
          $set: { "reservations.$[r].status": "reserved" },
        },
        {
          returnDocument: "after",
          arrayFilters: [{ "r.order": orderId, "r.quantity": qty, "r.status": "deducted" }],
        }
      ).catch((rollbackErr) => {
        console.error(`Deduction rollback failed for ${id}:`, rollbackErr.message);
        return null;
      });

      // Write a compensating audit log so the trail shows the reversal
      if (restored) {
        await writeLog(
          rolledDoc, qty, stockAtDeduction, restored.stock,
          "payment_failure",
          { order: orderId, performedBy, note: "Deduction rolled back due to partial failure" }
        ).catch((logErr) => console.error(`Rollback log failed for ${id}:`, logErr.message));
      }
    }
    throw err;
  }

  return logs;
};

/**
 * restoreStock — returns physical stock after cancellation of a paid order.
 * Only acts on reservations in "deducted" state, so it is safe to call even
 * if the order was never deducted (no-op in that case).
 * Idempotent: second call finds no "deducted" reservation and skips silently.
 */
const restoreStock = async (orderItems, orderId, performedBy, reason) => {
  const counts = await buildIngredientMap(orderItems);
  if (counts.size === 0) return [];

  const ids  = [...counts.keys()];
  const docs = await Inventory.find({ _id: { $in: ids } });
  const logs = [];

  for (const [id, qty] of counts) {
    const doc = docs.find((d) => d._id.toString() === id);
    if (!doc || doc.stock === -1) continue;

    const updated = await Inventory.findOneAndUpdate(
      {
        _id: id,
        reservations: {
          $elemMatch: { order: orderId, quantity: qty, status: "deducted" },
        },
      },
      {
        $inc: { stock: qty },
        $set: { "reservations.$[r].status": "restored" },
      },
      {
        returnDocument: "after",
        arrayFilters: [{ "r.order": orderId, "r.quantity": qty, "r.status": "deducted" }],
      }
    );

    if (!updated) continue;

    logs.push(
      await writeLog(
        doc, qty, doc.stock, updated.stock,
        reason || "order_cancellation",
        { order: orderId, performedBy }
      )
    );
  }

  return logs;
};

/**
 * adjustStock — admin manual adjustment (set absolute quantity).
 * Rejects values below the current reservedStock to prevent overselling
 * already-reserved stock.
 * Uses an optimistic-concurrency filter (stock === before) to detect
 * concurrent changes and ask the admin to retry.
 */
const adjustStock = async (ingredientId, newStock, performedBy, note) => {
  if (!Number.isInteger(newStock) || newStock < -1) {
    throw Object.assign(
      new Error("stock must be an integer >= -1 (use -1 for unlimited)"),
      { status: 400 }
    );
  }

  const doc = await Inventory.findById(ingredientId);
  if (!doc) {
    throw Object.assign(new Error("Inventory item not found"), { status: 404 });
  }

  const before   = doc.stock;
  const reserved = doc.reservedStock || 0;

  if (newStock !== -1 && newStock < reserved) {
    throw Object.assign(
      new Error(`Stock cannot be lower than reserved quantity (${reserved}).`),
      { status: 409 }
    );
  }

  const updated = await Inventory.findOneAndUpdate(
    {
      _id:           ingredientId,
      stock:         before,
      reservedStock: { $lte: newStock === -1 ? Number.MAX_SAFE_INTEGER : newStock },
    },
    { $set: { stock: newStock } },
    { returnDocument: "after" }
  );

  if (!updated) {
    throw Object.assign(
      new Error("Stock changed concurrently. Please retry the adjustment."),
      { status: 409 }
    );
  }

  await writeLog(
    updated, newStock - before, before, newStock,
    "manual_adjustment",
    { performedBy, note }
  );

  return updated;
};

/**
 * addStock — admin restock (increment by qty).
 * Uses optimistic concurrency to detect concurrent changes.
 */
const addStock = async (ingredientId, qty, performedBy, note) => {
  if (!Number.isInteger(qty) || qty <= 0) {
    throw Object.assign(
      new Error("qty must be a positive integer"),
      { status: 400 }
    );
  }

  const doc = await Inventory.findById(ingredientId);
  if (!doc) {
    throw Object.assign(new Error("Inventory item not found"), { status: 404 });
  }

  if (doc.stock === -1) return doc; // unlimited — nothing to increment

  const updated = await Inventory.findOneAndUpdate(
    { _id: ingredientId, stock: doc.stock },
    { $inc: { stock: qty } },
    { returnDocument: "after" }
  );

  if (!updated) {
    throw Object.assign(
      new Error("Stock changed concurrently. Please retry the restock."),
      { status: 409 }
    );
  }

  await writeLog(
    updated, qty, updated.stock - qty, updated.stock,
    "restock",
    { performedBy, note }
  );

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
