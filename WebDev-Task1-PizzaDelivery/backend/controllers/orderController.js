const Order     = require("../models/Order");
const Pizza     = require("../models/Pizza");
const Inventory = require("../models/Inventory");
const { ORDER_STATUSES } = require("../models/Order");
const { sendOrderConfirmation, sendStatusUpdate } = require("../utils/mailer");
const { validateStock, reserveStock, releaseReservation, restoreStock } = require("../utils/inventoryService");

const DELIVERY_FEE_P   = 4000;   // ₹40 in paise
const ESTIMATED_MINUTES = 45;

// ── Builder base price in paise ───────────────────────────────────────────────
const BUILDER_BASE_PRICE_P = 19900; // ₹199

const SIZE_MULTIPLIER = { Small: 0.8, Medium: 1.0, Large: 1.3 };

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Validate and price a MENU pizza item.
 * Returns an enriched item object with priceP set from DB.
 * Throws on invalid pizza / size.
 */
const enrichMenuItem = async (item) => {
  const pizza = await Pizza.findById(item.pizza);
  if (!pizza || !pizza.isAvailable)
    throw Object.assign(new Error(`Pizza not available: ${item.pizza}`), { status: 400 });

  const sizeData = pizza.sizes.find((s) => s.label === item.size);
  if (!sizeData)
    throw Object.assign(new Error(`Invalid size "${item.size}" for ${pizza.name}`), { status: 400 });

  return {
    itemType: "menu",
    pizza:    pizza._id,
    name:     pizza.name,
    size:     item.size,
    priceP:   sizeData.priceP,          // server-authoritative price
    quantity: Math.max(1, item.quantity || 1),
    toppings: item.toppings || [],
  };
};

/**
 * Validate and price a CUSTOM (builder) pizza item.
 * Fetches base/sauce/cheese/veggies from Inventory, sums priceP, applies size multiplier.
 * Throws on invalid/unavailable ingredients.
 */
const enrichCustomItem = async (item) => {
  const { base, sauce, cheese, veggies = [], size = "Medium" } = item.customPizza || {};

  if (!base || !sauce || !cheese)
    throw Object.assign(new Error("Custom pizza requires base, sauce, and cheese"), { status: 400 });

  if (!SIZE_MULTIPLIER[size])
    throw Object.assign(new Error(`Invalid size "${size}"`), { status: 400 });

  // Validate each ingredient against Inventory
  const [baseDoc, sauceDoc, cheeseDoc] = await Promise.all([
    Inventory.findOne({ _id: base,   category: "base",   isAvailable: true }),
    Inventory.findOne({ _id: sauce,  category: "sauce",  isAvailable: true }),
    Inventory.findOne({ _id: cheese, category: "cheese", isAvailable: true }),
  ]);

  if (!baseDoc)   throw Object.assign(new Error("Selected base is not available"),   { status: 400 });
  if (!sauceDoc)  throw Object.assign(new Error("Selected sauce is not available"),  { status: 400 });
  if (!cheeseDoc) throw Object.assign(new Error("Selected cheese is not available"), { status: 400 });

  let veggieDocs = [];
  if (veggies.length > 0) {
    veggieDocs = await Inventory.find({ _id: { $in: veggies }, category: "veggie", isAvailable: true });
    if (veggieDocs.length !== veggies.length) {
      throw Object.assign(new Error("One or more selected vegetables are not available"), { status: 400 });
    }
  }

  // Server-side price calculation — never trust client total
  const ingredientPriceP =
    baseDoc.priceP + sauceDoc.priceP + cheeseDoc.priceP +
    veggieDocs.reduce((s, v) => s + v.priceP, 0);

  const rawP    = BUILDER_BASE_PRICE_P + ingredientPriceP;
  const priceP  = Math.round(rawP * SIZE_MULTIPLIER[size]);

  return {
    itemType: "custom",
    name:     "Custom Pizza",
    size,
    priceP,
    quantity: Math.max(1, item.quantity || 1),
    toppings: veggieDocs.map((v) => v.name),
    customPizza: {
      base:        baseDoc._id,
      sauce:       sauceDoc._id,
      cheese:      cheeseDoc._id,
      veggies:     veggieDocs.map((v) => v._id),
      baseName:    baseDoc.name,
      sauceName:   sauceDoc.name,
      cheeseName:  cheeseDoc.name,
      veggieNames: veggieDocs.map((v) => v.name),
    },
  };
};

// ── POST /api/orders ──────────────────────────────────────────────────────────
const placeOrder = async (req, res) => {
  const { items, deliveryAddress, paymentMethod, notes } = req.body;

  if (!items?.length)
    return res.status(400).json({ message: "Order must have at least one item" });
  if (!deliveryAddress?.street || !deliveryAddress?.city ||
      !deliveryAddress?.state  || !deliveryAddress?.pincode)
    return res.status(400).json({ message: "Complete delivery address is required" });

  // Enrich and validate every item — prices come from DB, never from client
  const enriched = [];
  for (const item of items) {
    if (item.itemType === "custom" || item.customPizza) {
      enriched.push(await enrichCustomItem(item));
    } else {
      enriched.push(await enrichMenuItem(item));
    }
  }

  // Validate ingredient stock BEFORE creating the order — server-side only
  const { ok, shortfalls } = await validateStock(enriched);
  if (!ok) {
    return res.status(409).json({
      message: `Some ingredients are out of stock: ${shortfalls.map((s) => `"${s.name}" (need ${s.need}, available ${s.available})`).join("; ")}. Please update your cart.`,
      shortfalls,
    });
  }

  const subtotalP = enriched.reduce((s, i) => s + i.priceP * i.quantity, 0);
  const totalP    = subtotalP + DELIVERY_FEE_P;

  const order = await Order.create({
    user:             req.user._id,
    items:            enriched,
    deliveryAddress,
    subtotalP,
    deliveryFeeP:     DELIVERY_FEE_P,
    totalP,
    estimatedDelivery: new Date(Date.now() + ESTIMATED_MINUTES * 60 * 1000),
    notes,
    payment:          { method: paymentMethod || "cod" },
    statusHistory:    [{ status: "pending" }],
  });

  // Reserve stock (pre-payment hold) — idempotent via stockReserved flag
  try {
    await reserveStock(enriched, order._id);
    order.stockReserved = true;
    await order.save();
  } catch (reserveErr) {
    // If reservation fails (race condition), cancel the order immediately
    order.status = "cancelled";
    order.statusHistory.push({ status: "cancelled", note: `Stock reservation failed: ${reserveErr.message}` });
    await order.save();
    return res.status(409).json({ message: reserveErr.message, shortfalls: reserveErr.shortfalls });
  }

  await order.populate("user", "name email");

  // Send confirmation email only for COD — Razorpay orders get it after payment is verified
  if ((paymentMethod || "cod") === "cod") {
    sendOrderConfirmation(order).catch(console.error);
  }

  res.status(201).json({ order: orderResponse(order) });
};

// ── GET /api/orders ───────────────────────────────────────────────────────────
const getOrders = async (req, res) => {
  const filter = req.user.role === "admin" ? {} : { user: req.user._id };
  const { status, page = 1, limit = 10 } = req.query;
  if (status) filter.status = status;

  const skip = (Number(page) - 1) * Number(limit);
  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate("user", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Order.countDocuments(filter),
  ]);

  res.json({
    orders: orders.map(orderResponse),
    total,
    page:  Number(page),
    pages: Math.ceil(total / Number(limit)),
  });
};

// ── GET /api/orders/:id ───────────────────────────────────────────────────────
const getOrderById = async (req, res) => {
  const order = await Order.findById(req.params.id).populate("user", "name email");
  if (!order) return res.status(404).json({ message: "Order not found" });

  if (req.user.role !== "admin" && order.user._id.toString() !== req.user._id.toString())
    return res.status(403).json({ message: "Not authorized" });

  res.json({ order: orderResponse(order) });
};

// ── PUT /api/orders/:id/status  [admin] ───────────────────────────────────────
const updateOrderStatus = async (req, res) => {
  const { status, note } = req.body;

  if (!ORDER_STATUSES.includes(status))
    return res.status(400).json({ message: `Invalid status. Valid: ${ORDER_STATUSES.join(", ")}` });

  const order = await Order.findById(req.params.id).populate("user", "name email");
  if (!order) return res.status(404).json({ message: "Order not found" });

  if (["cancelled", "delivered"].includes(order.status))
    return res.status(400).json({ message: `Cannot update a ${order.status} order` });

  if (note) order.statusHistory.push({ status, note });
  order.status = status;
  if (status === "delivered") order.payment.status = "paid";

  await order.save();

  req.io.to(`order_${order._id}`).emit("order_status_update", {
    orderId:   order._id,
    status:    order.status,
    updatedAt: new Date(),
  });

  sendStatusUpdate(order).catch(console.error);

  res.json({ order: orderResponse(order) });
};

// ── PUT /api/orders/:id/cancel ────────────────────────────────────────────────
const cancelOrder = async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: "Order not found" });

  if (order.user.toString() !== req.user._id.toString())
    return res.status(403).json({ message: "Not authorized" });

  if (!["pending", "confirmed"].includes(order.status))
    return res.status(400).json({ message: "Order cannot be cancelled at this stage" });

  order.status = "cancelled";
  await order.save();

  // Release stock reservation / restore deducted stock
  if (order.stockDeducted) {
    restoreStock(order.items, order._id, req.user._id, "order_cancellation").catch(console.error);
  } else if (order.stockReserved) {
    releaseReservation(order.items, order._id, req.user._id, "order_cancellation").catch(console.error);
  }

  req.io.to(`order_${order._id}`).emit("order_status_update", {
    orderId:   order._id,
    status:    "cancelled",
    updatedAt: new Date(),
  });

  res.json({ order: orderResponse(order) });
};

// ── GET /api/orders/admin/stats  [admin] ──────────────────────────────────────
const getStats = async (req, res) => {
  const [statusCounts, revenue] = await Promise.all([
    Order.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Order.aggregate([
      { $match: { "payment.status": "paid" } },
      { $group: { _id: null, totalP: { $sum: "$totalP" } } },
    ]),
  ]);

  res.json({
    statusCounts:  Object.fromEntries(statusCounts.map((s) => [s._id, s.count])),
    totalRevenue:  Math.round((revenue[0]?.totalP || 0) / 100),  // rupees for display
    totalRevenueP: revenue[0]?.totalP || 0,
  });
};

// ── Response shaper ───────────────────────────────────────────────────────────
// Adds rupee virtuals alongside paise fields for frontend compatibility
const orderResponse = (order) => {
  const obj = order.toObject({ virtuals: true });
  // Ensure item-level price virtuals are included
  obj.items = obj.items.map((item) => ({
    ...item,
    price: Math.round(item.priceP / 100),
  }));
  return obj;
};

module.exports = { placeOrder, getOrders, getOrderById, updateOrderStatus, cancelOrder, getStats };
