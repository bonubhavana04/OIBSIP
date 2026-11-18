/**
 * tests/inventory.rollback.test.js
 *
 * Tests for:
 *   - Rollback audit log: compensating log entries are written when deductStock
 *     rolls back a partial deduction, so the audit trail is complete.
 *   - Stale paymentProcessing lock: an order locked > 5 min can be unlocked
 *     by the cron logic (tested directly against the DB).
 *   - Concurrent deductions: two simultaneous deductStock calls for the same
 *     order are idempotent — only one deduction lands.
 */

const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const os = require("os");
  await mongoose.connect(mongod.getUri(), {
    driverInfo: { name: "mongoose" },
    runtimeAdapters: { os },
  });
}, 120000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  const cols = mongoose.connection.collections;
  for (const key of Object.keys(cols)) {
    await cols[key].deleteMany({});
  }
});

const Inventory    = require("../models/Inventory");
const InventoryLog = require("../models/InventoryLog");
const Order        = require("../models/Order");
const User         = require("../models/User");

const {
  reserveStock,
  deductStock,
  releaseReservation,
} = require("../utils/inventoryService");

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeUser = () =>
  User.create({
    name: "Test User",
    email: `u_${Date.now()}_${Math.random()}@x.com`,
    password: "hashed",
    isEmailVerified: true,
  });

const makeIngredient = (overrides = {}) =>
  Inventory.create({
    category: "base",
    name: `Ing_${Date.now()}_${Math.random()}`,
    priceP: 0,
    stock: 10,
    emoji: "🫓",
    ...overrides,
  });

const makeCustomOrder = async (userId, base, sauce, cheese, qty = 1) =>
  Order.create({
    user: userId,
    items: [{
      itemType: "custom",
      name: "Custom Pizza",
      size: "Medium",
      priceP: 19900,
      quantity: qty,
      customPizza: {
        base, sauce, cheese,
        veggies: [],
        baseName: "B", sauceName: "S", cheeseName: "C", veggieNames: [],
      },
    }],
    deliveryAddress: { street: "1 St", city: "Mumbai", state: "MH", pincode: "400001" },
    subtotalP: 19900,
    deliveryFeeP: 4000,
    totalP: 23900,
    payment: { method: "cod" },
    statusHistory: [{ status: "pending" }],
  });

// ─────────────────────────────────────────────────────────────────────────────
// 1. Rollback audit log
// ─────────────────────────────────────────────────────────────────────────────

describe("deductStock rollback writes compensating audit logs", () => {
  test("payment_failure log is written for each rolled-back deduction", async () => {
    const base   = await makeIngredient({ name: "Base",   category: "base",   stock: 10 });
    const sauce  = await makeIngredient({ name: "Sauce",  category: "sauce",  stock: 10 });
    const cheese = await makeIngredient({ name: "Cheese", category: "cheese", stock: 10 });
    const user   = await makeUser();

    const order = await makeCustomOrder(user._id, base._id, sauce._id, cheese._id, 1);
    await reserveStock(order.items, order._id);

    // Force cheese stock to 0 after reservation so the deduction fails mid-loop
    await Inventory.updateOne({ _id: cheese._id }, { $set: { stock: 0 } });

    await expect(deductStock(order.items, order._id, user._id)).rejects.toThrow();

    // The ingredients that were deducted before the failure should have
    // compensating "payment_failure" logs written during rollback.
    const rollbackLogs = await InventoryLog.find({ reason: "payment_failure" });

    // At least one rollback log must exist (for whichever ingredient(s) were
    // deducted before cheese failed). The exact count depends on Map iteration
    // order, but there must be at least one.
    expect(rollbackLogs.length).toBeGreaterThanOrEqual(1);

    // Every rollback log must have a positive delta (stock was restored)
    for (const log of rollbackLogs) {
      expect(log.delta).toBeGreaterThan(0);
    }
  });

  test("no rollback logs are written when the very first ingredient fails", async () => {
    // If the first ingredient in the map fails, nothing was deducted yet,
    // so no rollback logs should be written.
    const base   = await makeIngredient({ name: "Base",   category: "base",   stock: 0 });
    const sauce  = await makeIngredient({ name: "Sauce",  category: "sauce",  stock: 10 });
    const cheese = await makeIngredient({ name: "Cheese", category: "cheese", stock: 10 });
    const user   = await makeUser();

    const order = await makeCustomOrder(user._id, base._id, sauce._id, cheese._id, 1);

    // Reserve with base having stock=0 — this will fail at reservation stage
    // so we need to manually insert a reservation to test deductStock directly.
    // Instead, use a scenario where base has stock but reservation is missing.
    // The deductStock will fail on the first ingredient with no reservation.
    await expect(deductStock(order.items, order._id, user._id)).rejects.toThrow();

    // No deduction logs and no rollback logs — nothing was deducted
    const allLogs = await InventoryLog.find({});
    expect(allLogs).toHaveLength(0);
  });

  test("stock and reservations are fully restored after rollback", async () => {
    const base   = await makeIngredient({ name: "Base",   category: "base",   stock: 10 });
    const sauce  = await makeIngredient({ name: "Sauce",  category: "sauce",  stock: 10 });
    const cheese = await makeIngredient({ name: "Cheese", category: "cheese", stock: 10 });
    const user   = await makeUser();

    const order = await makeCustomOrder(user._id, base._id, sauce._id, cheese._id, 1);
    await reserveStock(order.items, order._id);

    // Zero out cheese after reservation
    await Inventory.updateOne({ _id: cheese._id }, { $set: { stock: 0 } });

    await expect(deductStock(order.items, order._id, user._id)).rejects.toThrow();

    // All ingredients that were deducted must be back to their pre-deduction state
    const [b, s, c] = await Promise.all([
      Inventory.findById(base._id),
      Inventory.findById(sauce._id),
      Inventory.findById(cheese._id),
    ]);

    expect(b.stock).toBe(10);
    expect(s.stock).toBe(10);
    expect(c.stock).toBe(0); // was manually zeroed — rollback cannot exceed that

    // No ingredient should be in "deducted" reservation state
    for (const item of [b, s, c]) {
      const res = item.reservations.find((r) => r.order.toString() === order._id.toString());
      if (res) expect(res.status).not.toBe("deducted");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Stale paymentProcessing lock cleanup
// ─────────────────────────────────────────────────────────────────────────────

describe("stale paymentProcessing lock cleanup", () => {
  test("orders with paymentProcessing=true older than 5 min can be unlocked", async () => {
    const user = await makeUser();
    const base = await makeIngredient({ stock: 10 });

    const order = await Order.create({
      user: user._id,
      items: [{
        itemType: "custom",
        name: "Custom Pizza",
        size: "Medium",
        priceP: 19900,
        quantity: 1,
        customPizza: {
          base: base._id, sauce: base._id, cheese: base._id,
          veggies: [], baseName: "B", sauceName: "S", cheeseName: "C", veggieNames: [],
        },
      }],
      deliveryAddress: { street: "1 St", city: "Mumbai", state: "MH", pincode: "400001" },
      subtotalP: 19900,
      deliveryFeeP: 4000,
      totalP: 23900,
      payment: { method: "cod" },
      statusHistory: [{ status: "pending" }],
      paymentProcessing: true,
      paymentProcessingAt: new Date(Date.now() - 10 * 60 * 1000), // 10 min ago
    });

    // Simulate the cron logic
    const lockCutoff = new Date(Date.now() - 5 * 60 * 1000);
    const result = await Order.updateMany(
      {
        paymentProcessing: true,
        paymentProcessingAt: { $lt: lockCutoff },
      },
      {
        $set: { paymentProcessing: false, paymentProcessingAt: null },
      }
    );

    expect(result.modifiedCount).toBe(1);

    const updated = await Order.findById(order._id);
    expect(updated.paymentProcessing).toBe(false);
    expect(updated.paymentProcessingAt).toBeNull();
  });

  test("a recently locked order is NOT released by the cron", async () => {
    const user = await makeUser();
    const base = await makeIngredient({ stock: 10 });

    await Order.create({
      user: user._id,
      items: [{
        itemType: "custom",
        name: "Custom Pizza",
        size: "Medium",
        priceP: 19900,
        quantity: 1,
        customPizza: {
          base: base._id, sauce: base._id, cheese: base._id,
          veggies: [], baseName: "B", sauceName: "S", cheeseName: "C", veggieNames: [],
        },
      }],
      deliveryAddress: { street: "1 St", city: "Mumbai", state: "MH", pincode: "400001" },
      subtotalP: 19900,
      deliveryFeeP: 4000,
      totalP: 23900,
      payment: { method: "cod" },
      statusHistory: [{ status: "pending" }],
      paymentProcessing: true,
      paymentProcessingAt: new Date(Date.now() - 30 * 1000), // 30 seconds ago — fresh
    });

    const lockCutoff = new Date(Date.now() - 5 * 60 * 1000);
    const result = await Order.updateMany(
      {
        paymentProcessing: true,
        paymentProcessingAt: { $lt: lockCutoff },
      },
      {
        $set: { paymentProcessing: false, paymentProcessingAt: null },
      }
    );

    expect(result.modifiedCount).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Concurrent deductStock calls for the same order are idempotent
// ─────────────────────────────────────────────────────────────────────────────

describe("concurrent deductStock idempotency", () => {
  test("two simultaneous deductStock calls result in exactly one deduction", async () => {
    const base   = await makeIngredient({ name: "Base",   category: "base",   stock: 10 });
    const sauce  = await makeIngredient({ name: "Sauce",  category: "sauce",  stock: 10 });
    const cheese = await makeIngredient({ name: "Cheese", category: "cheese", stock: 10 });
    const user   = await makeUser();

    const order = await makeCustomOrder(user._id, base._id, sauce._id, cheese._id, 1);
    await reserveStock(order.items, order._id);

    // Fire two concurrent deductions — one must succeed, the other must be a no-op
    const results = await Promise.allSettled([
      deductStock(order.items, order._id, user._id),
      deductStock(order.items, order._id, user._id),
    ]);

    // At least one must succeed
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);

    // Physical stock must only be deducted once
    const [b, s, c] = await Promise.all([
      Inventory.findById(base._id),
      Inventory.findById(sauce._id),
      Inventory.findById(cheese._id),
    ]);

    expect(b.stock).toBe(9);  // 1 unit deducted (qty=1 per ingredient)
    expect(s.stock).toBe(9);
    expect(c.stock).toBe(9);

    // Exactly one deduction log per ingredient
    const deductionLogs = await InventoryLog.find({ reason: "order_deduction" });
    expect(deductionLogs).toHaveLength(3); // one per ingredient
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. releaseReservation is idempotent under concurrent calls
// ─────────────────────────────────────────────────────────────────────────────

describe("concurrent releaseReservation idempotency", () => {
  test("two simultaneous release calls do not double-decrement reservedStock", async () => {
    const base   = await makeIngredient({ name: "Base",   category: "base",   stock: 10 });
    const sauce  = await makeIngredient({ name: "Sauce",  category: "sauce",  stock: 10 });
    const cheese = await makeIngredient({ name: "Cheese", category: "cheese", stock: 10 });
    const user   = await makeUser();

    const order = await makeCustomOrder(user._id, base._id, sauce._id, cheese._id, 1);
    await reserveStock(order.items, order._id);

    await Promise.allSettled([
      releaseReservation(order.items, order._id, user._id, "order_cancellation"),
      releaseReservation(order.items, order._id, user._id, "order_cancellation"),
    ]);

    const [b, s, c] = await Promise.all([
      Inventory.findById(base._id),
      Inventory.findById(sauce._id),
      Inventory.findById(cheese._id),
    ]);

    // reservedStock must not go negative
    expect(b.reservedStock).toBe(0);
    expect(s.reservedStock).toBe(0);
    expect(c.reservedStock).toBe(0);

    // Physical stock unchanged
    expect(b.stock).toBe(10);
    expect(s.stock).toBe(10);
    expect(c.stock).toBe(10);
  });
});
