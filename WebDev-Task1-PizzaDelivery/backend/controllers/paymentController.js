const Razorpay   = require("razorpay");
const crypto     = require("crypto");
const Order      = require("../models/Order");
const { sendOrderConfirmation } = require("../utils/mailer");
const { deductStock, releaseReservation, restoreStock } = require("../utils/inventoryService");

// ── Razorpay client (test keys from env only — never hardcoded) ───────────────
const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Timing-safe HMAC-SHA256 signature verification.
 * Uses crypto.timingSafeEqual to prevent timing-oracle attacks.
 */
const verifySignature = (payload, secret, receivedHex) => {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  const a = Buffer.from(expected,    "hex");
  const b = Buffer.from(receivedHex, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};

// ── POST /api/payments/create-order ──────────────────────────────────────────
const createRazorpayOrder = async (req, res) => {
  const { orderId } = req.body;
  if (!orderId) return res.status(400).json({ message: "orderId is required" });

  const order = await Order.findById(orderId);
  if (!order) return res.status(404).json({ message: "Order not found" });

  if (order.user.toString() !== req.user._id.toString())
    return res.status(403).json({ message: "Not authorized" });

  if (order.payment.status === "paid")
    return res.status(400).json({ message: "Order already paid" });

  if (order.status === "cancelled")
    return res.status(400).json({ message: "Order has been cancelled" });

  if (order.payment.method !== "razorpay")
    return res.status(400).json({ message: "Order payment method is not Razorpay" });

  // Idempotency: reuse existing Razorpay order if already created
  if (order.payment.razorpayOrderId) {
    return res.json({
      razorpayOrderId: order.payment.razorpayOrderId,
      amount:          order.totalP,
      currency:        "INR",
      keyId:           process.env.RAZORPAY_KEY_ID,
    });
  }

  const rzpOrder = await razorpay.orders.create({
    amount:   order.totalP,
    currency: "INR",
    receipt:  order._id.toString().slice(-40),
    notes:    { orderId: order._id.toString(), env: process.env.NODE_ENV || "development" },
  });

  order.payment.razorpayOrderId = rzpOrder.id;
  await order.save();

  res.json({
    razorpayOrderId: rzpOrder.id,
    amount:          rzpOrder.amount,
    currency:        rzpOrder.currency,
    keyId:           process.env.RAZORPAY_KEY_ID,
  });
};

// ── POST /api/payments/verify ─────────────────────────────────────────────────
const verifyPayment = async (req, res) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature, orderId } = req.body;

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature || !orderId)
    return res.status(400).json({ message: "Missing payment verification fields" });

  const signaturePayload = `${razorpayOrderId}|${razorpayPaymentId}`;
  const valid = verifySignature(signaturePayload, process.env.RAZORPAY_KEY_SECRET, razorpaySignature);
  if (!valid)
    return res.status(400).json({ message: "Payment verification failed: invalid signature" });

  const order = await Order.findById(orderId).populate("user", "name email");
  if (!order) return res.status(404).json({ message: "Order not found" });

  if (order.user._id.toString() !== req.user._id.toString())
    return res.status(403).json({ message: "Not authorized" });

  if (order.payment.razorpayOrderId !== razorpayOrderId)
    return res.status(400).json({ message: "Razorpay order ID mismatch" });

  // Idempotency: already paid (webhook may have arrived first)
  if (order.payment.status === "paid")
    return res.json({ message: "Payment already confirmed", order: orderResponse(order) });

  await confirmPayment(order, razorpayPaymentId, razorpaySignature, req.io);

  res.json({ message: "Payment verified successfully", order: orderResponse(order) });
};

// ── POST /api/payments/webhook ────────────────────────────────────────────────
const handleWebhook = async (req, res) => {
  const receivedSignature = req.headers["x-razorpay-signature"];
  if (!receivedSignature)
    return res.status(400).json({ message: "Missing webhook signature header" });

  const rawBody = req.body;

  const valid = verifySignature(rawBody, process.env.RAZORPAY_WEBHOOK_SECRET, receivedSignature);
  if (!valid) {
    console.warn("Webhook: invalid signature — possible spoofed request");
    return res.status(400).json({ message: "Invalid webhook signature" });
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return res.status(400).json({ message: "Invalid JSON in webhook body" });
  }

  const eventType = event.event;
  const payload   = event.payload?.payment?.entity;

  // Acknowledge quickly — Razorpay retries on non-2xx
  res.status(200).json({ received: true });

  try {
    if (eventType === "payment.captured") {
      await handlePaymentCaptured(payload, req.io);
    } else if (eventType === "payment.failed") {
      await handlePaymentFailed(payload);
    }
  } catch (err) {
    console.error(`Webhook processing error [${eventType}]:`, err.message);
  }
};

// ── Webhook event handlers ────────────────────────────────────────────────────

const handlePaymentCaptured = async (payment, io) => {
  if (!payment?.order_id) return;

  const order = await Order.findOne({
    "payment.razorpayOrderId": payment.order_id,
  }).populate("user", "name email");

  if (!order) {
    console.warn(`Webhook: no order found for Razorpay order ${payment.order_id}`);
    return;
  }

  if (order.payment.status === "paid") {
    console.log(`Webhook: order ${order._id} already paid — skipping`);
    return;
  }

  await confirmPayment(order, payment.id, null, io);
  console.log(`Webhook: confirmed payment for order ${order._id}`);
};

const handlePaymentFailed = async (payment) => {
  if (!payment?.order_id) return;

  const order = await Order.findOne({
    "payment.razorpayOrderId": payment.order_id,
  });

  if (!order || order.payment.status === "paid") return;

  order.payment.status = "failed";
  await order.save();

  // Release the stock reservation so other orders can use the stock
  if (order.stockReserved && !order.stockDeducted) {
    releaseReservation(order.items, order._id, null, "payment_failure").catch(console.error);
  }

  console.log(`Webhook: marked payment failed for order ${order._id}`);
};

// ── Shared confirmation logic ─────────────────────────────────────────────────
// Called by verifyPayment (client) and handlePaymentCaptured (webhook).
// Idempotency:
//   - payment.status === "paid" check in callers prevents re-entry
//   - stockDeducted flag + findOneAndUpdate($set) prevents duplicate deductions

const confirmPayment = async (order, razorpayPaymentId, razorpaySignature, io) => {
  order.payment.status            = "paid";
  order.payment.razorpayPaymentId = razorpayPaymentId;
  if (razorpaySignature) order.payment.razorpaySignature = razorpaySignature;
  order.payment.paidAt            = new Date();
  order.status                    = "confirmed";
  await order.save();

  // Deduct inventory stock — idempotent via stockDeducted flag.
  // findOneAndUpdate with { stockDeducted: false } filter ensures only one
  // concurrent caller (verify vs webhook) actually triggers the deduction.
  if (!order.stockDeducted) {
    const claimed = await Order.findOneAndUpdate(
      { _id: order._id, stockDeducted: false },
      { $set: { stockDeducted: true } },
      { new: false }   // return old doc — if it was already true, old.stockDeducted === true
    );

    if (claimed && !claimed.stockDeducted) {
      // We won the race — perform the deduction
      deductStock(order.items, order._id, null).catch((err) => {
        console.error(`Stock deduction error for order ${order._id}:`, err.message);
        // Roll back the flag so a retry is possible
        Order.findByIdAndUpdate(order._id, { $set: { stockDeducted: false } }).catch(console.error);
      });
    }
  }

  if (io) {
    io.to(`order_${order._id}`).emit("order_status_update", {
      orderId:   order._id,
      status:    "confirmed",
      updatedAt: new Date(),
    });
  }

  sendOrderConfirmation(order).catch(console.error);
};

// ── POST /api/payments/cod-confirm ───────────────────────────────────────────
const confirmCOD = async (req, res) => {
  const { orderId } = req.body;

  const order = await Order.findById(orderId).populate("user", "name email");
  if (!order) return res.status(404).json({ message: "Order not found" });

  if (order.user._id.toString() !== req.user._id.toString())
    return res.status(403).json({ message: "Not authorized" });

  if (order.payment.method !== "cod")
    return res.status(400).json({ message: "Not a COD order" });

  if (order.status !== "pending")
    return res.status(400).json({ message: "Order already processed" });

  order.status = "confirmed";
  await order.save();

  // Deduct stock for COD orders (idempotent via stockDeducted flag)
  if (!order.stockDeducted) {
    const claimed = await Order.findOneAndUpdate(
      { _id: order._id, stockDeducted: false },
      { $set: { stockDeducted: true } },
      { new: false }
    );
    if (claimed && !claimed.stockDeducted) {
      deductStock(order.items, order._id, null).catch((err) => {
        console.error(`COD stock deduction error for order ${order._id}:`, err.message);
        Order.findByIdAndUpdate(order._id, { $set: { stockDeducted: false } }).catch(console.error);
      });
    }
  }

  if (req.io) {
    req.io.to(`order_${order._id}`).emit("order_status_update", {
      orderId:   order._id,
      status:    "confirmed",
      updatedAt: new Date(),
    });
  }

  sendOrderConfirmation(order).catch(console.error);

  res.json({ message: "COD order confirmed", order: orderResponse(order) });
};

// ── GET /api/payments/status/:orderId ────────────────────────────────────────
const getPaymentStatus = async (req, res) => {
  const order = await Order.findById(req.params.orderId).select("payment status user");
  if (!order) return res.status(404).json({ message: "Order not found" });

  if (
    order.user.toString() !== req.user._id.toString() &&
    req.user.role !== "admin"
  ) {
    return res.status(403).json({ message: "Not authorized" });
  }

  res.json({ payment: order.payment, status: order.status });
};

// ── Response shaper ───────────────────────────────────────────────────────────
const orderResponse = (order) => {
  const obj = order.toObject({ virtuals: true });
  obj.items = obj.items.map((item) => ({ ...item, price: Math.round(item.priceP / 100) }));
  return obj;
};

module.exports = {
  createRazorpayOrder,
  verifyPayment,
  handleWebhook,
  confirmCOD,
  getPaymentStatus,
};
