/**
 * tests/inventory.menu.test.js
 *
 * Supplementary tests for scenarios not covered in inventory.test.js:
 *   - Menu-pizza ingredient tracking via PizzaIngredient recipes
 *   - adjustStock blocked when new value < reservedStock
 *   - Three-ingredient order: partial deduction rollback leaves all three clean
 *   - validateStock accounts for already-reserved stock across two orders
 *   - releaseReservation writes exactly one audit log per call
 *
 * Run: npm test  (from backend/)
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

const Inventory      = require("../models/Inventory");
const InventoryLog   = require("../models/InventoryLog");
const Order          = require("../models/Order");
const User           = require("../models/User");
const Pizza          = require("../models/Pizza");
const Category       = require("../models/Category");
const PizzaIngredient = require("../models/PizzaIngredient");

const {
  validateStock,
  reserveStock,
  releaseReservation,
  deductStock,
  adjustStock,
  buildIngredientMap,
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
    stock: 20,
    emoji: "🫓",
    ...overrides,
  });

const makeCategory = () =>
  Category.create({ name: `Cat_${Date.now()}` });

const makePizza = async (categoryId) =>
  Pizza.create({
    name: `Pizza_${Date.now()}`,
    category: categoryId,
    sizes: [{ label: "Medium", priceP: 19900 }],
  });

const makeMenuOrder = async (userId, pizzaId, qty = 1) =>
  Order.create({
    user: userId,
    items: [{
      itemType: "menu",
      pizza: pizzaId,
      name: "Test Pizza",
      size: "Medium",
      priceP: 19900,
      quantity: qty,
    }],
    deliveryAddress: { street: "1 St", city: "Mumbai", state: "MH", pincode: "400001" },
    subtotalP: 19900,
    deliveryFeeP: 4000,
    totalP: 23900,
    payment: { method: "cod" },
    statusHistory: [{ status: "pending" }],
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
// 1. Menu-pizza ingredient tracking via PizzaIngredient
// ─────────────────────────────────────────────────────────────────────────────

describe("menu-pizza ingredient tracking via PizzaIngredient", () => {
  test("buildIngredientMap resolves recipe quantities for a menu pizza", async () => {
    const cat   = await makeCategory();
    const pizza = await makePizza(cat._id);
    const base  = await makeIngredient({ category: "base",   stock: 20 });
    const sauce = await makeIngredient({ category: "sauce",  stock: 20 });

    await PizzaIngredient.create([
      { pizza: pizza._id, ingredient: base._id,  qty: 2 },
      { pizza: pizza._id, ingredient: sauce._id, qty: 1 },
    ]);

    const user  = await makeUser();
    const order = await makeMenuOrder(user._id, pizza._id, 3); // qty=3

    const counts = await buildIngredientMap(order.items);

    expect(counts.get(base._id.toString())).toBe(6);  // 2 per pizza × 3
    expect(counts.get(sauce._id.toString())).toBe(3); // 1 per pizza × 3
  });

  test("validateStock uses PizzaIngredient recipe for menu pizzas", async () => {
    const cat   = await makeCategory();
    const pizza = await makePizza(cat._id);
    const base  = await makeIngredient({ category: "base", stock: 5 });

    await PizzaIngredient.create({ pizza: pizza._id, ingredient: base._id, qty: 3 });

    const user  = await makeUser();
    // qty=2 → needs 6 units, only 5 available
    const order = await makeMenuOrder(user._id, pizza._id, 2);

    const { ok, shortfalls } = await validateStock(order.items);

    expect(ok).toBe(false);
    expect(shortfalls[0].need).toBe(6);
    expect(shortfalls[0].available).toBe(5);
  });

  test("reserveStock and deductStock work end-to-end for a menu pizza", async () => {
    const cat   = await makeCategory();
    const pizza = await makePizza(cat._id);
    const base  = await makeIngredient({ category: "base",  stock: 10 });
    const sauce = await makeIngredient({ category: "sauce", stock: 10 });

    await PizzaIngredient.create([
      { pizza: pizza._id, ingredient: base._id,  qty: 1 },
      { pizza: pizza._id, ingredient: sauce._id, qty: 1 },
    ]);

    const user  = await makeUser();
    const order = await makeMenuOrder(user._id, pizza._id, 2); // needs 2 of each

    await reserveStock(order.items, order._id);

    const baseAfterReserve  = await Inventory.findById(base._id);
    const sauceAfterReserve = await Inventory.findById(sauce._id);
    expect(baseAfterReserve.reservedStock).toBe(2);
    expect(sauceAfterReserve.reservedStock).toBe(2);
    expect(baseAfterReserve.stock).toBe(10); // physical unchanged

    await deductStock(order.items, order._id, user._id);

    const baseAfterDeduct  = await Inventory.findById(base._id);
    const sauceAfterDeduct = await Inventory.findById(sauce._id);
    expect(baseAfterDeduct.stock).toBe(8);
    expect(sauceAfterDeduct.stock).toBe(8);
    expect(baseAfterDeduct.reservedStock).toBe(0);

    const logs = await InventoryLog.find({ reason: "order_deduction" });
    expect(logs).toHaveLength(2);
  });

  test("menu pizza with no recipe does not affect inventory", async () => {
    const cat   = await makeCategory();
    const pizza = await makePizza(cat._id);
    // No PizzaIngredient rows created

    const user  = await makeUser();
    const order = await makeMenuOrder(user._id, pizza._id, 5);

    const { ok } = await validateStock(order.items);
    expect(ok).toBe(true);

    await reserveStock(order.items, order._id); // should be a no-op
    const counts = await buildIngredientMap(order.items);
    expect(counts.size).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. adjustStock blocked when new value is below reservedStock
// ─────────────────────────────────────────────────────────────────────────────

describe("adjustStock reserved-stock guard", () => {
  test("rejects a new stock value lower than current reservedStock", async () => {
    const ing  = await makeIngredient({ stock: 20, reservedStock: 8 });
    const user = await makeUser();

    await expect(adjustStock(ing._id, 5, user._id, "test"))
      .rejects.toThrow(/reserved quantity/);

    const unchanged = await Inventory.findById(ing._id);
    expect(unchanged.stock).toBe(20);
  });

  test("allows setting stock equal to reservedStock", async () => {
    const ing  = await makeIngredient({ stock: 20, reservedStock: 8 });
    const user = await makeUser();

    await adjustStock(ing._id, 8, user._id, "tight but valid");

    const updated = await Inventory.findById(ing._id);
    expect(updated.stock).toBe(8);
  });

  test("allows setting stock to -1 (unlimited) regardless of reservedStock", async () => {
    const ing  = await makeIngredient({ stock: 20, reservedStock: 15 });
    const user = await makeUser();

    await adjustStock(ing._id, -1, user._id, "set unlimited");

    const updated = await Inventory.findById(ing._id);
    expect(updated.stock).toBe(-1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Three-ingredient order: partial deduction rollback
// ─────────────────────────────────────────────────────────────────────────────

describe("three-ingredient partial deduction rollback", () => {
  test("all three ingredients are restored when the third deduction fails", async () => {
    const base   = await makeIngredient({ name: "Base",   category: "base",   stock: 10 });
    const sauce  = await makeIngredient({ name: "Sauce",  category: "sauce",  stock: 10 });
    const cheese = await makeIngredient({ name: "Cheese", category: "cheese", stock: 10 });
    const user   = await makeUser();

    const order = await makeCustomOrder(user._id, base._id, sauce._id, cheese._id, 1);

    await reserveStock(order.items, order._id);

    // Drain cheese stock below the reserved amount to force deduction failure
    await Inventory.updateOne({ _id: cheese._id }, { $set: { stock: 0 } });

    await expect(deductStock(order.items, order._id, user._id)).rejects.toThrow();

    const [b, s, c] = await Promise.all([
      Inventory.findById(base._id),
      Inventory.findById(sauce._id),
      Inventory.findById(cheese._id),
    ]);

    // Physical stock must be unchanged for all three
    expect(b.stock).toBe(10);
    expect(s.stock).toBe(10);
    expect(c.stock).toBe(0); // was manually zeroed, rollback cannot restore beyond that

    // Reservations must still be in "reserved" state (not "deducted")
    const bRes = b.reservations.find((r) => r.order.toString() === order._id.toString());
    const sRes = s.reservations.find((r) => r.order.toString() === order._id.toString());
    expect(bRes.status).toBe("reserved");
    expect(sRes.status).toBe("reserved");

    // The audit trail is append-only — logs written before the failure are kept.
    // What matters is that stock and reservation state are fully rolled back.
    // Verify no ingredient ended up in "deducted" reservation state.
    const allItems = await Inventory.find({ _id: { $in: [base._id, sauce._id, cheese._id] } });
    for (const item of allItems) {
      const res = item.reservations.find((r) => r.order.toString() === order._id.toString());
      if (res) expect(res.status).not.toBe("deducted");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. validateStock accounts for reservations from a prior order
// ─────────────────────────────────────────────────────────────────────────────

describe("validateStock with existing reservations", () => {
  test("second order sees reduced available stock after first order reserves", async () => {
    const ing  = await makeIngredient({ stock: 6 });
    const user = await makeUser();

    // First order reserves 3 units (base+sauce+cheese each = 1 ref × qty 1 = 3 total)
    const order1 = await Order.create({
      user: user._id,
      items: [{
        itemType: "custom", name: "P", size: "Medium", priceP: 100, quantity: 1,
        customPizza: {
          base: ing._id, sauce: ing._id, cheese: ing._id,
          veggies: [], baseName: "B", sauceName: "S", cheeseName: "C", veggieNames: [],
        },
      }],
      deliveryAddress: { street: "1 St", city: "Mumbai", state: "MH", pincode: "400001" },
      subtotalP: 100, deliveryFeeP: 4000, totalP: 4100,
      payment: { method: "cod" },
      statusHistory: [{ status: "pending" }],
    });

    await reserveStock(order1.items, order1._id);

    // Manually set reservedStock to reflect the 3 units held
    const afterReserve = await Inventory.findById(ing._id);
    expect(afterReserve.reservedStock).toBe(3);

    // Second order also needs 3 units — only 3 remain available (6 - 3 reserved)
    const order2 = await Order.create({
      user: user._id,
      items: [{
        itemType: "custom", name: "P", size: "Medium", priceP: 100, quantity: 1,
        customPizza: {
          base: ing._id, sauce: ing._id, cheese: ing._id,
          veggies: [], baseName: "B", sauceName: "S", cheeseName: "C", veggieNames: [],
        },
      }],
      deliveryAddress: { street: "1 St", city: "Mumbai", state: "MH", pincode: "400001" },
      subtotalP: 100, deliveryFeeP: 4000, totalP: 4100,
      payment: { method: "cod" },
      statusHistory: [{ status: "pending" }],
    });

    const { ok } = await validateStock(order2.items);
    expect(ok).toBe(true); // exactly 3 available, needs 3

    // Third order would need 3 more but only 0 remain after order2 reserves
    await reserveStock(order2.items, order2._id);

    const order3 = await Order.create({
      user: user._id,
      items: [{
        itemType: "custom", name: "P", size: "Medium", priceP: 100, quantity: 1,
        customPizza: {
          base: ing._id, sauce: ing._id, cheese: ing._id,
          veggies: [], baseName: "B", sauceName: "S", cheeseName: "C", veggieNames: [],
        },
      }],
      deliveryAddress: { street: "1 St", city: "Mumbai", state: "MH", pincode: "400001" },
      subtotalP: 100, deliveryFeeP: 4000, totalP: 4100,
      payment: { method: "cod" },
      statusHistory: [{ status: "pending" }],
    });

    const { ok: ok3, shortfalls } = await validateStock(order3.items);
    expect(ok3).toBe(false);
    expect(shortfalls[0].available).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. releaseReservation writes exactly one audit log per call
// ─────────────────────────────────────────────────────────────────────────────

describe("releaseReservation audit log", () => {
  test("writes one log entry per ingredient released", async () => {
    const base   = await makeIngredient({ category: "base",   stock: 10 });
    const sauce  = await makeIngredient({ category: "sauce",  stock: 10 });
    const cheese = await makeIngredient({ category: "cheese", stock: 10 });
    const user   = await makeUser();

    const order = await makeCustomOrder(user._id, base._id, sauce._id, cheese._id, 1);
    await reserveStock(order.items, order._id);

    await releaseReservation(order.items, order._id, user._id, "order_cancellation");

    const logs = await InventoryLog.find({ reason: "order_cancellation" });
    // Three distinct ingredients → three log entries
    expect(logs).toHaveLength(3);

    // Second call must not add more logs (idempotent)
    await releaseReservation(order.items, order._id, user._id, "order_cancellation");
    const logsAfter = await InventoryLog.find({ reason: "order_cancellation" });
    expect(logsAfter).toHaveLength(3);
  });
});
