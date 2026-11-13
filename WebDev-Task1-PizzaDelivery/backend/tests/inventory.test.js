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
  test("deducts physical stock and releases the order's reservation", async () => {
    const ing = await makeIngredient({ stock: 10 });
    const user = await makeUser();
    const order = await makeOrder(user._id, [ing._id], 1);

    await reserveStock(order.items, order._id);
    await deductStock(order.items, order._id, user._id);

    const updated = await Inventory.findById(ing._id);
    expect(updated.stock).toBe(7);
    expect(updated.reservedStock).toBe(0);

    const reservation = updated.reservations.find(
      (r) => r.order.toString() === order._id.toString()
    );
    expect(reservation.status).toBe("deducted");
  });

  test("writes an audit log for each deduction", async () => {
    const ing = await makeIngredient({ stock: 10 });
    const user = await makeUser();
    const order = await makeOrder(user._id, [ing._id], 1);

    await reserveStock(order.items, order._id);
    await deductStock(order.items, order._id, user._id);

    const logs = await InventoryLog.find({ ingredient: ing._id });
    expect(logs).toHaveLength(1);
    expect(logs[0].reason).toBe("order_deduction");
    expect(logs[0].delta).toBe(-3);
  });

  test("does not deduct the same order twice", async () => {
    const ing = await makeIngredient({ stock: 10 });
    const user = await makeUser();
    const order = await makeOrder(user._id, [ing._id], 1);

    await reserveStock(order.items, order._id);
    await deductStock(order.items, order._id, user._id);
    await deductStock(order.items, order._id, user._id);

    const updated = await Inventory.findById(ing._id);
    expect(updated.stock).toBe(7);
    expect(updated.reservedStock).toBe(0);

    const logs = await InventoryLog.find({ ingredient: ing._id });
    expect(logs).toHaveLength(1);
  });

  test("rejects deduction when an order has no reservation", async () => {
  const ing = await makeIngredient({ stock: 10 });
  const user = await makeUser();
  const order = await makeOrder(user._id, [ing._id], 1);

  await expect(
    deductStock(order.items, order._id, user._id)
  ).rejects.toMatchObject({
    status: 409,
  });

  const updated = await Inventory.findById(ing._id);

  expect(updated.stock).toBe(10);
  expect(updated.reservedStock).toBe(0);
  expect(await InventoryLog.countDocuments({ ingredient: ing._id })).toBe(0);
});
  test("skips unlimited ingredients", async () => {
    const ing = await makeIngredient({ stock: -1 });
    const user = await makeUser();
    const order = await makeOrder(user._id, [ing._id], 5);

    await reserveStock(order.items, order._id);
    await deductStock(order.items, order._id, user._id);

    const updated = await Inventory.findById(ing._id);
    expect(updated.stock).toBe(-1);
    expect(updated.reservedStock).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Concurrent orders competing for the same stock
// ─────────────────────────────────────────────────────────────────────────────


describe("concurrent orders competing for the same stock", () => {
  test("only one of two simultaneous reservations succeeds when stock is tight", async () => {
    const ing = await makeIngredient({ stock: 3 });
    const user = await makeUser();

    const order1 = await makeOrder(user._id, [ing._id], 1);
    const order2 = await makeOrder(user._id, [ing._id], 1);

    const results = await Promise.allSettled([
      reserveStock(order1.items, order1._id),
      reserveStock(order2.items, order2._id),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);

    const updated = await Inventory.findById(ing._id);
    expect(updated.reservedStock).toBe(3);
    expect(updated.stock).toBe(3);
    expect(updated.reservations.filter((r) => r.status === "reserved")).toHaveLength(1);
  });

  test("repeated reservation calls for the same order do not reserve twice", async () => {
    const ing = await makeIngredient({ stock: 10 });
    const user = await makeUser();
    const order = await makeOrder(user._id, [ing._id], 1);

    await Promise.all([
      reserveStock(order.items, order._id),
      reserveStock(order.items, order._id),
    ]);

    const updated = await Inventory.findById(ing._id);
    expect(updated.reservedStock).toBe(3);
    expect(updated.reservations).toHaveLength(1);
  });

  test("two separately reserved orders can deduct without overselling", async () => {
    const ing = await makeIngredient({ stock: 6 });
    const user = await makeUser();

    const order1 = await makeOrder(user._id, [ing._id], 1);
    const order2 = await makeOrder(user._id, [ing._id], 1);

    await reserveStock(order1.items, order1._id);
    await reserveStock(order2.items, order2._id);

    const results = await Promise.allSettled([
      deductStock(order1.items, order1._id, user._id),
      deductStock(order2.items, order2._id, user._id),
    ]);

    expect(results.every((r) => r.status === "fulfilled")).toBe(true);

    const updated = await Inventory.findById(ing._id);
    expect(updated.stock).toBe(0);
    expect(updated.reservedStock).toBe(0);
    expect(updated.reservations.filter((r) => r.status === "deducted")).toHaveLength(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Duplicate payment notifications (idempotency)
// ─────────────────────────────────────────────────────────────────────────────

describe("duplicate payment notifications", () => {
  test("stockDeducted flag prevents double deduction", async () => {
    const ing = await makeIngredient({ stock: 10, reservedStock: 0 });
    const user = await makeUser();
    const order = await makeOrder(user._id, [ing._id], 1);
    await reserveStock(order.items, order._id);
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
        { returnDocument: 'before' }
      ),
      Order.findOneAndUpdate(
        { _id: order._id, stockDeducted: false },
        { $set: { stockDeducted: true } },
        { returnDocument: 'before' }
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
  test("releases only the specified order's reservation", async () => {
    const ing = await makeIngredient({ stock: 10 });
    const user = await makeUser();

    const order1 = await makeOrder(user._id, [ing._id], 1);
    const order2 = await makeOrder(user._id, [ing._id], 1);

    await reserveStock(order1.items, order1._id);
    await reserveStock(order2.items, order2._id);

    await releaseReservation(
      order1.items,
      order1._id,
      user._id,
      "order_cancellation"
    );

    const updated = await Inventory.findById(ing._id);

    expect(updated.stock).toBe(10);
    expect(updated.reservedStock).toBe(3);

    const first = updated.reservations.find(
      (r) => r.order.toString() === order1._id.toString()
    );
    const second = updated.reservations.find(
      (r) => r.order.toString() === order2._id.toString()
    );

    expect(first.status).toBe("released");
    expect(second.status).toBe("reserved");
  });

  test("does not release the same reservation twice", async () => {
    const ing = await makeIngredient({ stock: 10 });
    const user = await makeUser();
    const order = await makeOrder(user._id, [ing._id], 1);

    await reserveStock(order.items, order._id);

    await releaseReservation(order.items, order._id, user._id, "order_cancellation");
    await releaseReservation(order.items, order._id, user._id, "order_cancellation");

    const updated = await Inventory.findById(ing._id);

    expect(updated.reservedStock).toBe(0);
    expect(updated.stock).toBe(10);

    const reservation = updated.reservations.find(
      (r) => r.order.toString() === order._id.toString()
    );
    expect(reservation.status).toBe("released");

    const logs = await InventoryLog.find({ ingredient: ing._id });
    expect(logs.filter((log) => log.reason === "order_cancellation")).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. restoreStock (cancellation after deduction)
// ─────────────────────────────────────────────────────────────────────────────


describe("restoreStock", () => {
  test("restores stock only after a successful deduction", async () => {
    const ing = await makeIngredient({ stock: 10 });
    const user = await makeUser();
    const order = await makeOrder(user._id, [ing._id], 1);

    await reserveStock(order.items, order._id);
    await deductStock(order.items, order._id, user._id);
    await restoreStock(order.items, order._id, user._id, "order_cancellation");

    const updated = await Inventory.findById(ing._id);

    expect(updated.stock).toBe(10);
    expect(updated.reservedStock).toBe(0);

    const reservation = updated.reservations.find(
      (r) => r.order.toString() === order._id.toString()
    );
    expect(reservation.status).toBe("restored");

    const logs = await InventoryLog.find({ ingredient: ing._id });
    expect(logs.filter((log) => log.reason === "order_cancellation")).toHaveLength(1);
  });

  test("does not restore the same order twice", async () => {
    const ing = await makeIngredient({ stock: 10 });
    const user = await makeUser();
    const order = await makeOrder(user._id, [ing._id], 1);

    await reserveStock(order.items, order._id);
    await deductStock(order.items, order._id, user._id);

    await restoreStock(order.items, order._id, user._id, "order_cancellation");
    await restoreStock(order.items, order._id, user._id, "order_cancellation");

    const updated = await Inventory.findById(ing._id);
    expect(updated.stock).toBe(10);

    const logs = await InventoryLog.find({
      ingredient: ing._id,
      reason: "order_cancellation",
    });
    expect(logs).toHaveLength(1);
  });

  test("does not restore stock for an order without a deduction record", async () => {
    const ing = await makeIngredient({ stock: 7 });
    const user = await makeUser();
    const order = await makeOrder(user._id, [ing._id], 1);

    await restoreStock(order.items, order._id, user._id, "order_cancellation");

    const updated = await Inventory.findById(ing._id);
    expect(updated.stock).toBe(7);
    expect(await InventoryLog.countDocuments({ ingredient: ing._id })).toBe(0);
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


describe("transaction failure rollback", () => {
  test("does not leave partial deductions when a later ingredient fails", async () => {
    const ing1 = await makeIngredient({
      name: "Base A",
      category: "base",
      stock: 10,
    });

    const ing2 = await makeIngredient({
      name: "Sauce A",
      category: "sauce",
      stock: 10,
    });

    const user = await makeUser();

    const order = await Order.create({
      user: user._id,
      items: [{
        itemType: "custom",
        name: "Custom Pizza",
        size: "Medium",
        priceP: 19900,
        quantity: 1,
        customPizza: {
          base: ing1._id,
          sauce: ing2._id,
          cheese: ing2._id,
          veggies: [],
          baseName: "Base A",
          sauceName: "Sauce A",
          cheeseName: "Sauce A",
          veggieNames: [],
        },
      }],
      deliveryAddress: {
        street: "1 Test St",
        city: "Mumbai",
        state: "MH",
        pincode: "400001",
      },
      subtotalP: 19900,
      deliveryFeeP: 4000,
      totalP: 23900,
      payment: { method: "cod" },
      statusHistory: [{ status: "pending" }],
    });

    await reserveStock(order.items, order._id);

    // Simulate a stock conflict after reservation.
    await Inventory.updateOne(
      { _id: ing2._id },
      { $set: { stock: 1 } }
    );

    await expect(
      deductStock(order.items, order._id, user._id)
    ).rejects.toThrow();

    const updated1 = await Inventory.findById(ing1._id);
    const updated2 = await Inventory.findById(ing2._id);

   expect(updated1.stock).toBe(10);
   expect(updated1.reservedStock).toBe(1);
   expect(updated2.stock).toBe(1);
   expect(updated2.reservedStock).toBe(2);

    const reservation1 = updated1.reservations.find(
      (r) => r.order.toString() === order._id.toString()
    );

    expect(reservation1.status).toBe("reserved");
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
