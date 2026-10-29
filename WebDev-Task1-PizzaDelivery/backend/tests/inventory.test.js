/**
 * tests/inventory.test.js
 *
 * Tests for the inventory management system.
 * Uses mongodb-memory-server (started in globalSetup.js) so no real MongoDB is required.
 *
 * Run: npm test  (from backend/)
 */

const fs       = require("fs");
const path     = require("path");
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  // Fix for Node 24 + Jest: the mongodb driver uses dynamic import('os') which
  // returns a different object inside Jest's VM context. Providing the os module
  // via runtimeAdapters forces the driver to use require('os') instead.
  const os = require("os");
  await mongoose.connect(mongod.getUri(), {
    driverInfo: { name: "mongoose" },
    runtimeAdapters: { os },
  });
}, 120000);  // 2 min — binary is cached after first run, subsequent runs are fast

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
});

// ── Model imports (after connection is established) ───────────────────────────
const Inventory    = require("../models/Inventory");
const InventoryLog = require("../models/InventoryLog");
const Order        = require("../models/Order");
const User         = require("../models/User");

const {
  validateStock,
  reserveStock,
  releaseReservation,
  deductStock,
  restoreStock,
  adjustStock,
  addStock,
} = require("../utils/inventoryService");

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeIngredient = (overrides = {}) =>
  Inventory.create({
    category:  "base",
    name:      "Test Base",
    priceP:    0,
    stock:     10,
    emoji:     "🫓",
    ...overrides,
  });

const makeUser = () =>
  User.create({
    name:            "Test User",
    email:           `test_${Date.now()}@example.com`,
    password:        "hashed",
    isEmailVerified: true,
  });

/**
 * Build a minimal order document with a custom pizza referencing the given ingredient IDs.
 */
const makeOrder = async (userId, ingredientIds, qty = 1) => {
  const items = ingredientIds.map((id) => ({
    itemType: "custom",
    name:     "Custom Pizza",
    size:     "Medium",
    priceP:   19900,
    quantity: qty,
    customPizza: {
      base:        id,
      sauce:       id,
      cheese:      id,
      veggies:     [],
      baseName:    "Test Base",
      sauceName:   "Test Sauce",
      cheeseName:  "Test Cheese",
      veggieNames: [],
    },
  }));

  return Order.create({
    user:            userId,
    items,
    deliveryAddress: { street: "1 Test St", city: "Mumbai", state: "MH", pincode: "400001" },
    subtotalP:       19900,
    deliveryFeeP:    4000,
    totalP:          23900,
    payment:         { method: "cod" },
    statusHistory:   [{ status: "pending" }],
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. validateStock
// ─────────────────────────────────────────────────────────────────────────────

describe("validateStock", () => {
  test("returns ok:true when stock is sufficient", async () => {
    const ing = await makeIngredient({ stock: 5 });
    const user = await makeUser();
    const order = await makeOrder(user._id, [ing._id], 2);

    // Each custom pizza uses base+sauce+cheese = 3 references to the same ingredient
    // qty=2 means 6 total needed — but stock is 5 → should fail
    // Let's use qty=1 → 3 needed, stock=5 → ok
    const singleOrder = await makeOrder(user._id, [ing._id], 1);
    const result = await validateStock(singleOrder.items);
    expect(result.ok).toBe(true);
    expect(result.shortfalls).toHaveLength(0);
  });

  test("returns shortfalls when stock is insufficient", async () => {
    const ing = await makeIngredient({ stock: 2 });
    const user = await makeUser();
    // qty=1 → base+sauce+cheese = 3 references, need 3, have 2
    const order = await makeOrder(user._id, [ing._id], 1);

    const result = await validateStock(order.items);
    expect(result.ok).toBe(false);
    expect(result.shortfalls.length).toBeGreaterThan(0);
    expect(result.shortfalls[0].name).toBe("Test Base");
  });

  test("treats stock=-1 as unlimited (always ok)", async () => {
    const ing = await makeIngredient({ stock: -1 });
    const user = await makeUser();
    const order = await makeOrder(user._id, [ing._id], 100);

    const result = await validateStock(order.items);
    expect(result.ok).toBe(true);
  });

  test("returns ok:true for menu-only orders (no inventory)", async () => {
    const result = await validateStock([
      { itemType: "menu", pizza: new mongoose.Types.ObjectId(), name: "Margherita", size: "Medium", priceP: 19900, quantity: 2 },
    ]);
    expect(result.ok).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. reserveStock
// ─────────────────────────────────────────────────────────────────────────────

describe("reserveStock", () => {
  test("increments reservedStock without touching physical stock", async () => {
    const ing = await makeIngredient({ stock: 10 });
    const user = await makeUser();
    // qty=1 → 3 references (base+sauce+cheese) to same ingredient
    const order = await makeOrder(user._id, [ing._id], 1);

    await reserveStock(order.items, order._id);

    const updated = await Inventory.findById(ing._id);
    expect(updated.stock).toBe(10);          // physical unchanged
    expect(updated.reservedStock).toBe(3);   // 3 references × qty 1
  });

  test("throws when available stock is insufficient", async () => {
    const ing = await makeIngredient({ stock: 2 });
    const user = await makeUser();
    const order = await makeOrder(user._id, [ing._id], 1); // needs 3

    await expect(reserveStock(order.items, order._id)).rejects.toThrow(/Insufficient stock/);
  });

  test("accounts for existing reservations when checking availability", async () => {
    const ing = await makeIngredient({ stock: 5, reservedStock: 4 }); // only 1 available
    const user = await makeUser();
    const order = await makeOrder(user._id, [ing._id], 1); // needs 3

    await expect(reserveStock(order.items, order._id)).rejects.toThrow(/Insufficient stock/);
  });

  test("skips unlimited ingredients", async () => {
    const ing = await makeIngredient({ stock: -1 });
    const user = await makeUser();
    const order = await makeOrder(user._id, [ing._id], 5);

    await reserveStock(order.items, order._id);

    const updated = await Inventory.findById(ing._id);
    expect(updated.reservedStock).toBe(0); // unlimited — nothing reserved
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. deductStock
// ─────────────────────────────────────────────────────────────────────────────

describe("deductStock", () => {
  test("decrements physical stock and releases reservation", async () => {
    const ing = await makeIngredient({ stock: 10, reservedStock: 3 });
    const user = await makeUser();
    const order = await makeOrder(user._id, [ing._id], 1); // 3 refs

    await deductStock(order.items, order._id, user._id);

    const updated = await Inventory.findById(ing._id);
    expect(updated.stock).toBe(7);          // 10 - 3
    expect(updated.reservedStock).toBe(0);  // 3 - 3
  });

  test("writes InventoryLog entries for each deduction", async () => {
    const ing = await makeIngredient({ stock: 10, reservedStock: 3 });
    const user = await makeUser();
    const order = await makeOrder(user._id, [ing._id], 1);

    await deductStock(order.items, order._id, user._id);

    const logs = await InventoryLog.find({ ingredient: ing._id });
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].reason).toBe("order_deduction");
    expect(logs[0].delta).toBe(-3);
  });

  test("throws and rolls back when stock is insufficient at deduction time", async () => {
    // Simulate race: stock was 3 when reserved, but another order consumed it
    const ing = await makeIngredient({ stock: 1, reservedStock: 0 }); // only 1 left
    const user = await makeUser();
    const order = await makeOrder(user._id, [ing._id], 1); // needs 3

    await expect(deductStock(order.items, order._id, user._id)).rejects.toThrow();

    // Stock should be unchanged after rollback
    const updated = await Inventory.findById(ing._id);
    expect(updated.stock).toBe(1);
  });

  test("skips unlimited ingredients", async () => {
    const ing = await makeIngredient({ stock: -1 });
    const user = await makeUser();
    const order = await makeOrder(user._id, [ing._id], 5);

    await deductStock(order.items, order._id, user._id);

    const updated = await Inventory.findById(ing._id);
    expect(updated.stock).toBe(-1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Concurrent orders competing for the same stock
// ─────────────────────────────────────────────────────────────────────────────

describe("concurrent orders competing for the same stock", () => {
  test("only one of two simultaneous reservations succeeds when stock is tight", async () => {
    // stock=3 → exactly enough for one order (3 refs), not two
    const ing = await makeIngredient({ stock: 3 });
    const user = await makeUser();

    const order1 = await makeOrder(user._id, [ing._id], 1);
    const order2 = await makeOrder(user._id, [ing._id], 1);

    const results = await Promise.allSettled([
      reserveStock(order1.items, order1._id),
      reserveStock(order2.items, order2._id),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected  = results.filter((r) => r.status === "rejected");

    // Exactly one should succeed, one should fail
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    expect(rejected[0].reason.message).toMatch(/Insufficient stock/);

    // reservedStock should be exactly 3 (one order's worth)
    const updated = await Inventory.findById(ing._id);
    expect(updated.reservedStock).toBe(3);
  });

  test("concurrent deductions: $gte guard prevents overselling", async () => {
    // stock=3, two orders both try to deduct 3 simultaneously
    const ing = await makeIngredient({ stock: 3, reservedStock: 0 });
    const user = await makeUser();

    const order1 = await makeOrder(user._id, [ing._id], 1);
    const order2 = await makeOrder(user._id, [ing._id], 1);

    const results = await Promise.allSettled([
      deductStock(order1.items, order1._id, user._id),
      deductStock(order2.items, order2._id, user._id),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected  = results.filter((r) => r.status === "rejected");

    // At least one must fail — stock cannot go below 0
    expect(rejected.length).toBeGreaterThanOrEqual(1);

    const updated = await Inventory.findById(ing._id);
    expect(updated.stock).toBeGreaterThanOrEqual(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Duplicate payment notifications (idempotency)
// ─────────────────────────────────────────────────────────────────────────────

describe("duplicate payment notifications", () => {
  test("stockDeducted flag prevents double deduction", async () => {
    const ing = await makeIngredient({ stock: 10, reservedStock: 3 });
    const user = await makeUser();
    const order = await makeOrder(user._id, [ing._id], 1);

    // First deduction
    await deductStock(order.items, order._id, user._id);
    await Order.findByIdAndUpdate(order._id, { stockDeducted: true });

    const afterFirst = await Inventory.findById(ing._id);
    expect(afterFirst.stock).toBe(7);

    // Simulate duplicate webhook: check flag before deducting (as confirmPayment does)
    const freshOrder = await Order.findById(order._id);
    if (!freshOrder.stockDeducted) {
      await deductStock(order.items, order._id, user._id);
    }

    // Stock must still be 7 — no second deduction
    const afterSecond = await Inventory.findById(ing._id);
    expect(afterSecond.stock).toBe(7);
  });

  test("findOneAndUpdate with stockDeducted:false filter is atomic", async () => {
    const ing = await makeIngredient({ stock: 10, reservedStock: 3 });
    const user = await makeUser();
    const order = await makeOrder(user._id, [ing._id], 1);

    // Two concurrent callers both try to claim the deduction
    const [r1, r2] = await Promise.all([
      Order.findOneAndUpdate(
        { _id: order._id, stockDeducted: false },
        { $set: { stockDeducted: true } },
        { new: false }
      ),
      Order.findOneAndUpdate(
        { _id: order._id, stockDeducted: false },
        { $set: { stockDeducted: true } },
        { new: false }
      ),
    ]);

    // Exactly one caller gets the old doc with stockDeducted:false (wins the race)
    const winners = [r1, r2].filter((r) => r && !r.stockDeducted);
    expect(winners.length).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. releaseReservation
// ─────────────────────────────────────────────────────────────────────────────

describe("releaseReservation", () => {
  test("decrements reservedStock without touching physical stock", async () => {
    const ing = await makeIngredient({ stock: 10, reservedStock: 3 });
    const user = await makeUser();
    const order = await makeOrder(user._id, [ing._id], 1);

    await releaseReservation(order.items, order._id, user._id, "order_cancellation");

    const updated = await Inventory.findById(ing._id);
    expect(updated.stock).toBe(10);         // unchanged
    expect(updated.reservedStock).toBe(0);  // released
  });

  test("clamps reservedStock at 0 (idempotent double-release)", async () => {
    const ing = await makeIngredient({ stock: 10, reservedStock: 3 });
    const user = await makeUser();
    const order = await makeOrder(user._id, [ing._id], 1);

    await releaseReservation(order.items, order._id, user._id, "order_cancellation");
    await releaseReservation(order.items, order._id, user._id, "order_cancellation"); // second call

    const updated = await Inventory.findById(ing._id);
    expect(updated.reservedStock).toBeGreaterThanOrEqual(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. restoreStock (cancellation after deduction)
// ─────────────────────────────────────────────────────────────────────────────

describe("restoreStock", () => {
  test("returns physical stock and writes audit log", async () => {
    const ing = await makeIngredient({ stock: 7 }); // after deduction
    const user = await makeUser();
    const order = await makeOrder(user._id, [ing._id], 1); // 3 refs

    await restoreStock(order.items, order._id, user._id, "order_cancellation");

    const updated = await Inventory.findById(ing._id);
    expect(updated.stock).toBe(10); // 7 + 3

    const logs = await InventoryLog.find({ ingredient: ing._id });
    expect(logs.length).toBe(1);
    expect(logs[0].reason).toBe("order_cancellation");
    expect(logs[0].delta).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Admin stock adjustments
// ─────────────────────────────────────────────────────────────────────────────

describe("adjustStock / addStock", () => {
  test("adjustStock sets absolute value and writes log", async () => {
    const ing = await makeIngredient({ stock: 10 });
    const user = await makeUser();

    await adjustStock(ing._id, 25, user._id, "Manual count correction");

    const updated = await Inventory.findById(ing._id);
    expect(updated.stock).toBe(25);

    const logs = await InventoryLog.find({ ingredient: ing._id });
    expect(logs[0].reason).toBe("manual_adjustment");
    expect(logs[0].delta).toBe(15);   // 25 - 10
    expect(logs[0].note).toBe("Manual count correction");
  });

  test("adjustStock to -1 sets unlimited", async () => {
    const ing = await makeIngredient({ stock: 5 });
    const user = await makeUser();

    await adjustStock(ing._id, -1, user._id, "Set unlimited");

    const updated = await Inventory.findById(ing._id);
    expect(updated.stock).toBe(-1);
  });

  test("adjustStock rejects invalid values", async () => {
    const ing = await makeIngredient({ stock: 5 });
    const user = await makeUser();

    await expect(adjustStock(ing._id, -2, user._id, "bad")).rejects.toThrow(/integer >= -1/);
    await expect(adjustStock(ing._id, 1.5, user._id, "bad")).rejects.toThrow(/integer >= -1/);
  });

  test("addStock increments and writes restock log", async () => {
    const ing = await makeIngredient({ stock: 5 });
    const user = await makeUser();

    await addStock(ing._id, 20, user._id, "Weekly delivery");

    const updated = await Inventory.findById(ing._id);
    expect(updated.stock).toBe(25);

    const logs = await InventoryLog.find({ ingredient: ing._id });
    expect(logs[0].reason).toBe("restock");
    expect(logs[0].delta).toBe(20);
  });

  test("addStock rejects non-positive quantities", async () => {
    const ing = await makeIngredient({ stock: 5 });
    const user = await makeUser();

    await expect(addStock(ing._id, 0,  user._id, "bad")).rejects.toThrow(/positive integer/);
    await expect(addStock(ing._id, -5, user._id, "bad")).rejects.toThrow(/positive integer/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. Transaction failure / rollback
// ─────────────────────────────────────────────────────────────────────────────

describe("transaction failure rollback (_deductSequential)", () => {
  test("rolls back already-deducted items when a later item fails", async () => {
    // Two separate ingredients; second one has insufficient stock
    const ing1 = await makeIngredient({ name: "Base A",   category: "base",   stock: 10 });
    const ing2 = await makeIngredient({ name: "Sauce A",  category: "sauce",  stock: 1  });
    const user = await makeUser();

    // Build an order that uses ing1 as base AND ing2 as sauce
    const order = await Order.create({
      user:            user._id,
      items: [{
        itemType: "custom",
        name:     "Custom Pizza",
        size:     "Medium",
        priceP:   19900,
        quantity: 1,
        customPizza: {
          base:        ing1._id,
          sauce:       ing2._id,
          cheese:      ing2._id,  // ing2 used twice → needs 2, has 1
          veggies:     [],
          baseName:    "Base A",
          sauceName:   "Sauce A",
          cheeseName:  "Sauce A",
          veggieNames: [],
        },
      }],
      deliveryAddress: { street: "1 Test St", city: "Mumbai", state: "MH", pincode: "400001" },
      subtotalP: 19900, deliveryFeeP: 4000, totalP: 23900,
      payment: { method: "cod" },
      statusHistory: [{ status: "pending" }],
    });

    await expect(deductStock(order.items, order._id, user._id)).rejects.toThrow();

    // ing1 must be restored to 10 (rollback)
    const updated1 = await Inventory.findById(ing1._id);
    expect(updated1.stock).toBe(10);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. Insufficient ingredients at order placement
// ─────────────────────────────────────────────────────────────────────────────

describe("insufficient ingredients at order placement", () => {
  test("validateStock returns useful shortfall details", async () => {
    const ing = await makeIngredient({ name: "Thin Crust", stock: 0 });
    const user = await makeUser();
    const order = await makeOrder(user._id, [ing._id], 1);

    const { ok, shortfalls } = await validateStock(order.items);

    expect(ok).toBe(false);
    expect(shortfalls[0]).toMatchObject({
      name:      "Thin Crust",
      need:      expect.any(Number),
      available: 0,
    });
  });

  test("reserveStock error message names the out-of-stock ingredient", async () => {
    const ing = await makeIngredient({ name: "Gluten-Free Base", stock: 0 });
    const user = await makeUser();
    const order = await makeOrder(user._id, [ing._id], 1);

    await expect(reserveStock(order.items, order._id))
      .rejects
      .toThrow(/Gluten-Free Base/);
  });
});
