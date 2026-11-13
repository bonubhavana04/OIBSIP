const Order      = require("../models/Order");
const Pizza      = require("../models/Pizza");
const Inventory  = require("../models/Inventory");
const Storefront = require("../models/Storefront");
const { ORDER_STATUSES } = require("../models/Order");
const { sendOrderConfirmation, sendStatusUpdate } = require("../utils/mailer");
const { validateStock, reserveStock, releaseReservation, restoreStock } = require("../utils/inventoryService");
const { createRefund } = require("../utils/razorpayRefund");
const crypto = require("crypto");
const DELIVERY_FEE_P   = 4000;   // ₹40 in paise
const ESTIMATED_MINUTES = 45;
const { initiateFullRefund } = require("./paymentController");
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
  const { base, sauce, cheese, veggies = [] } = item.customPizza || {};
const size = item.size || item.customPizza?.size || "Medium";

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
  if (
  !Array.isArray(items) ||
  items.length > 50 ||
  items.some(
    (item) =>
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 20
  )
) {
  return res.status(400).json({
    message: "Each item must have a whole-number quantity between 1 and 20, with at most 50 order items.",
  });
}
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
  const grossTotalP = subtotalP + DELIVERY_FEE_P;

  // ── Server-side promo validation ─────────────────────────────────────────
  let discountP = 0;
  let appliedPromoCode = null;
  const { promoCode } = req.body;

  if (promoCode) {
    const sfDoc = await Storefront.findOne();
    const promo = sfDoc?.published?.promotions?.find(
      (p) => p.promoCode?.toUpperCase() === promoCode.toUpperCase().trim()
    );
    const now = Date.now();
    const isValid =
      promo &&
      promo.isActive &&
      (!promo.startDate || new Date(promo.startDate).getTime() <= now) &&
      (!promo.endDate   || new Date(promo.endDate).getTime()   >= now);

    if (isValid) {
      const orderTotalRupees = Math.round(grossTotalP / 100);
      if (!promo.minOrderAmount || orderTotalRupees >= promo.minOrderAmount) {
        const rawDiscount = promo.discountType === "percentage"
          ? Math.round(grossTotalP * promo.discountValue / 100)
          : Math.min(promo.discountValue * 100, grossTotalP);
        discountP = rawDiscount;
        appliedPromoCode = promo.promoCode;
      }
    }
  }

  const totalP = Math.max(0, grossTotalP - discountP);

  const order = await Order.create({
    user:             req.user._id,
    items:            enriched,
    deliveryAddress,
    subtotalP,
    deliveryFeeP:     DELIVERY_FEE_P,
    discountP,
    promoCode:        appliedPromoCode,
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

 // Send COD confirmation email only once per order
if ((paymentMethod || "cod") === "cod") {
  const emailClaim = await Order.findOneAndUpdate(
    {
      _id: order._id,
      orderConfirmationEmailSent: false,
    },
    {
      $set: { orderConfirmationEmailSent: true },
    },
    { returnDocument: "before" }
  );

  if (emailClaim && !emailClaim.orderConfirmationEmailSent) {
    sendOrderConfirmation(order).catch(async (err) => {
      console.error("COD confirmation email failed:", err.message);

      await Order.findOneAndUpdate(
        { _id: order._id, orderConfirmationEmailSent: true },
        { $set: { orderConfirmationEmailSent: false } }
      ).catch(console.error);
    });
  }
}

  res.status(201).json({ order: orderResponse(order) });
};

// ── GET /api/orders ───────────────────────────────────────────────────────────
const getOrders = async (req, res) => {
  const filter = req.user.role === "admin" ? {} : { user: req.user._id };
  const { status, page = 1, limit = 10, dateFrom, dateTo } = req.query;
  if (status) filter.status = status;

  // Date range filter (admin only to avoid customer abuse)
  if (req.user.role === "admin") {
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }
  }

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

  if (!ORDER_STATUSES.includes(status)) {
    return res.status(400).json({
      message: `Invalid status. Valid: ${ORDER_STATUSES.join(", ")}`,
    });
  }

  const order = await Order.findById(req.params.id).populate("user", "name email");

  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }

  if (["cancelled", "delivered"].includes(order.status)) {
    return res.status(400).json({
      message: `Cannot update a ${order.status} order`,
    });
  }

  const allowedTransitions = {
    pending: ["confirmed"],
    confirmed: ["preparing"],
    preparing: ["out_for_delivery"],
    out_for_delivery: ["delivered"],
  };

  if (!allowedTransitions[order.status]?.includes(status)) {
    return res.status(400).json({
      message: `Cannot change order status from ${order.status} to ${status}`,
    });
  }
if (order.status === "pending" && status === "confirmed" && !order.stockDeducted) {
  return res.status(409).json({
    message: "Payment or COD confirmation must complete inventory deduction before confirming this order.",
  });
}
  if (status === "delivered") {
    if (order.payment.status !== "paid") {
      return res.status(400).json({
        message: "Payment must be completed before delivery.",
      });
    }

    if (!order.stockDeducted) {
      return res.status(409).json({
        message: "Inventory deduction must be completed before delivery.",
      });
    }
  }

  order.status = status;
  order.statusHistory.push({
    status,
    ...(note ? { note } : {}),
  });

  await order.save();

  if (req.io) {
    req.io.to(`order_${order._id}`).emit("order_status_update", {
      orderId: order._id,
      status: order.status,
      updatedAt: new Date(),
    });
  }

  sendStatusUpdate(order).catch(console.error);

  return res.json({ order: orderResponse(order) });
};

// ── PUT /api/orders/:id/cancel ────────────────────────────────────────────────



const cancelOrder = async (req, res) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }

  if (order.user.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: "Not authorized" });
  }

  if (!["pending", "confirmed"].includes(order.status)) {
    return res.status(400).json({
      message: "Order cannot be cancelled at this stage",
    });
  }

  // Atomically acquire the same lock used by payment confirmation.
  const lock = await Order.findOneAndUpdate(
    {
      _id: order._id,
      status: { $in: ["pending", "confirmed"] },
      paymentProcessing: { $ne: true },
    },
    {
      $set: {
        paymentProcessing: true,
        paymentProcessingAt: new Date(),
      },
    },
    { new: true }
  );

  if (!lock) {
    return res.status(409).json({
      message:
        "This order is currently being processed or has already changed. Please refresh and try again.",
    });
  }

  try {
    const currentOrder = await Order.findById(order._id);

    if (
      !currentOrder ||
      !["pending", "confirmed"].includes(currentOrder.status)
    ) {
      throw Object.assign(
        new Error("Order can no longer be cancelled."),
        { status: 409 }
      );
    }

    const isPaidRazorpay =
      currentOrder.payment?.method === "razorpay" &&
      currentOrder.payment?.status === "paid";

    // For COD and unpaid orders, restore/release inventory first.
    if (!isPaidRazorpay) {
      if (currentOrder.stockDeducted) {
        await restoreStock(
          currentOrder.items,
          currentOrder._id,
          req.user._id,
          "order_cancellation"
        );
      } else if (currentOrder.stockReserved) {
        await releaseReservation(
          currentOrder.items,
          currentOrder._id,
          req.user._id,
          "order_cancellation"
        );
      }
    }

    // Persist cancellation only after inventory handling succeeds.
    currentOrder.status = "cancelled";
    await currentOrder.save();

    // Release the processing lock.
    await Order.findOneAndUpdate(
      {
        _id: currentOrder._id,
        paymentProcessing: true,
      },
      {
        $set: {
          paymentProcessing: false,
          paymentProcessingAt: null,
        },
      }
    );

    currentOrder.paymentProcessing = false;
    currentOrder.paymentProcessingAt = null;

    // A paid Razorpay order is refunded separately.
    // Inventory is restored only after the refund webhook confirms success.
    if (isPaidRazorpay) {
      const refund = await initiateFullRefund(currentOrder);

      if (req.io) {
        req.io.to(`order_${currentOrder._id}`).emit("order_status_update", {
          orderId: currentOrder._id,
          status: "cancelled",
          updatedAt: new Date(),
        });
      }

      return res.status(202).json({
        message: "Order cancelled. Refund processing has been initiated.",
        refundStatus: refund.status,
        order: orderResponse(currentOrder),
      });
    }

    if (req.io) {
      req.io.to(`order_${currentOrder._id}`).emit("order_status_update", {
        orderId: currentOrder._id,
        status: "cancelled",
        updatedAt: new Date(),
      });
    }

    return res.json({
      message: "Order cancelled successfully.",
      order: orderResponse(currentOrder),
    });
  } catch (err) {
    console.error("Order cancellation error:", err.message);

    // Release the lock after failure.
    await Order.findOneAndUpdate(
      {
        _id: order._id,
        paymentProcessing: true,
      },
      {
        $set: {
          paymentProcessing: false,
          paymentProcessingAt: null,
        },
      }
    ).catch((releaseError) => {
      console.error(
        "Could not release cancellation lock:",
        releaseError.message
      );
    });

    return res.status(err.status || 500).json({
      message:
        "Order cancellation could not be completed safely. Please contact support if the issue persists.",
    });
  }
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
  obj.items = obj.items.map((item) => ({
    ...item,
    price: Math.round(item.priceP / 100),
  }));
  // Ensure discount fields are always present for frontend
  obj.discount  = Math.round((obj.discountP || 0) / 100);
  obj.promoCode = obj.promoCode || null;
  return obj;
};

module.exports = { placeOrder, getOrders, getOrderById, updateOrderStatus, cancelOrder, getStats };
