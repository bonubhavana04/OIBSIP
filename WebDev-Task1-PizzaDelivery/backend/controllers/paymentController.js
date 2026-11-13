const Razorpay   = require("razorpay");
const crypto     = require("crypto");
const Order      = require("../models/Order");
const { sendOrderConfirmation } = require("../utils/mailer");
const { deductStock, releaseReservation, restoreStock } = require("../utils/inventoryService");
const { createRefund } = require("../utils/razorpayRefund");

// ── Razorpay client — lazy so the server starts without payment keys ──────────
let _razorpay = null;
const getRazorpay = () => {
  if (_razorpay) return _razorpay;
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw Object.assign(
      new Error("Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env to enable online payments."),
      { status: 503 }
    );
  }
  _razorpay = new Razorpay({
    key_id:     process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
  return _razorpay;
};

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


const initiateFullRefund = async (order) => {
  if (!order || order.status !== "cancelled") {
    throw new Error("Only cancelled orders can be refunded.");
  }

  if (order.payment.method !== "razorpay") {
    throw new Error("Refunds are only supported for Razorpay orders.");
  }

  // Return immediately if the refund has already been processed.
  if (order.payment.refundStatus === "processed") {
    return {
      status: "processed",
      refundId: order.payment.razorpayRefundId,
    };
  }

  if (
    order.payment.status !== "paid" ||
    !order.payment.razorpayPaymentId ||
    !order.payment.razorpayOrderId
  ) {
    throw new Error("A captured Razorpay payment is required for a refund.");
  }

  // If a refund ID already exists, do not create another refund.
  if (order.payment.razorpayRefundId) {
    return {
      status: order.payment.refundStatus,
      refundId: order.payment.razorpayRefundId,
    };
  }

  // Generate a key once. Concurrent requests must reuse the stored key.
  const candidateKey = crypto.randomUUID();

  let currentOrder = await Order.findOneAndUpdate(
    {
      _id: order._id,
      status: "cancelled",
      "payment.method": "razorpay",
      "payment.status": "paid",
      "payment.refundStatus": { $in: ["none", "pending", "failed"] },
      "payment.razorpayRefundId": { $exists: false },
      $or: [
        { "payment.refundIdempotencyKey": null },
        { "payment.refundIdempotencyKey": { $exists: false } },
      ],
    },
    {
      $set: {
        "payment.refundIdempotencyKey": candidateKey,
        "payment.refundStatus": "pending",
        "payment.refundAmountP": order.totalP,
        "payment.refundInitiatedAt": new Date(),
        "payment.refundFailureReason": null,
      },
    },
    { new: true }
  );

  // If another request already stored a key, reuse it.
  if (!currentOrder) {
    currentOrder = await Order.findById(order._id);

    if (!currentOrder) {
      throw new Error("Order not found during refund processing.");
    }

    if (currentOrder.payment.refundStatus === "processed") {
      return {
        status: "processed",
        refundId: currentOrder.payment.razorpayRefundId,
      };
    }

    if (currentOrder.payment.razorpayRefundId) {
      return {
        status: currentOrder.payment.refundStatus,
        refundId: currentOrder.payment.razorpayRefundId,
      };
    }

    if (!currentOrder.payment.refundIdempotencyKey) {
      throw new Error(
        "Unable to establish a persistent refund idempotency key."
      );
    }

    if (currentOrder.payment.status !== "paid") {
      throw new Error("Payment is not eligible for a refund.");
    }
  }

  const refund = await createRefund({
    paymentId: currentOrder.payment.razorpayPaymentId,
    razorpayOrderId: currentOrder.payment.razorpayOrderId,
    amountP: currentOrder.totalP,
    idempotencyKey: currentOrder.payment.refundIdempotencyKey,
    orderId: currentOrder._id,
  });

  if (!refund?.id) {
    throw new Error(
      "Razorpay did not return a refund ID. Reconciliation required."
    );
  }

  await Order.findOneAndUpdate(
    {
      _id: currentOrder._id,
      "payment.refundIdempotencyKey":
        currentOrder.payment.refundIdempotencyKey,
    },
    {
      $set: {
        "payment.razorpayRefundId": refund.id,
        "payment.refundStatus": "pending",
      },
    }
  );

  return {
    status: "pending",
    refundId: refund.id,
  };
};


// ── POST /api/payments/create-order ──────────────────────────────────────────
const createRazorpayOrder = async (req, res) => {
  // Guard: reject until Razorpay keys are configured
  let rzp;
  try { rzp = getRazorpay(); } catch (e) {
    return res.status(e.status || 503).json({ message: e.message });
  }

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

  const rzpOrder = await rzp.orders.create({
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
  if (!process.env.RAZORPAY_KEY_SECRET) {
    return res.status(503).json({ message: "Online payments are not yet configured." });
  }

  const {
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
    orderId,
  } = req.body;

  if (
    !razorpayOrderId ||
    !razorpayPaymentId ||
    !razorpaySignature ||
    !orderId
  ) {
    return res.status(400).json({
      message: "Missing payment verification fields",
    });
  }

  const signaturePayload = `${razorpayOrderId}|${razorpayPaymentId}`;

  const valid = verifySignature(
    signaturePayload,
    process.env.RAZORPAY_KEY_SECRET,
    razorpaySignature
  );

  if (!valid) {
    return res.status(400).json({
      message: "Payment verification failed: invalid signature",
    });
  }

  const order = await Order.findById(orderId).populate("user", "name email");

  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }

  if (
    !order.user ||
    order.user._id.toString() !== req.user._id.toString()
  ) {
    return res.status(403).json({ message: "Not authorized" });
  }

  if (order.payment.razorpayOrderId !== razorpayOrderId) {
    return res.status(400).json({
      message: "Razorpay order ID mismatch",
    });
  }

  // Never confirm or revive a cancelled order.
  if (order.status === "cancelled") {
    return res.status(409).json({
      message:
        "This order has already been cancelled. Payment reconciliation is required.",
    });
  }

  // Skip only when payment and inventory are both fully processed.
  if (order.payment.status === "paid" && order.stockDeducted) {
    return res.json({
      message: "Payment already confirmed",
      order: orderResponse(order),
    });
  }

  await confirmPayment(
    order,
    razorpayPaymentId,
    razorpaySignature,
    req.io
  );

  return res.json({
    message: "Payment verified successfully",
    order: orderResponse(order),
  });
};


// ── POST /api/payments/webhook ────────────────────────────────────────────────

const handleWebhook = async (req, res) => {
  if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
    return res.status(503).json({ message: "Webhook not configured" });
  }

  const receivedSignature = req.headers["x-razorpay-signature"];

  if (!receivedSignature) {
    return res.status(400).json({
      message: "Missing webhook signature header",
    });
  }

  const rawBody = req.body;

  const valid = verifySignature(
    rawBody,
    process.env.RAZORPAY_WEBHOOK_SECRET,
    receivedSignature
  );

  if (!valid) {
    console.warn("Webhook: invalid signature — possible spoofed request");
    return res.status(400).json({
      message: "Invalid webhook signature",
    });
  }

  let event;

  try {
    event = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return res.status(400).json({
      message: "Invalid JSON in webhook body",
    });
  }

  const eventType = event.event;
  const paymentPayload = event.payload?.payment?.entity;
  const refundPayload  = event.payload?.refund?.entity;

  try {
    if (eventType === "payment.captured") {
      await handlePaymentCaptured(paymentPayload, req.io);
    } else if (eventType === "payment.failed") {
      await handlePaymentFailed(paymentPayload);
    } else if (eventType === "refund.processed") {
      await handleRefundProcessed(refundPayload);
    } else if (eventType === "refund.failed") {
      await handleRefundFailed(refundPayload);
    }
    // Unknown events are acknowledged so Razorpay does not retry them.
  } catch (err) {
    console.error(`Webhook processing error [${eventType}]:`, err.message);
    // Return 500 so Razorpay retries the delivery.
    return res.status(500).json({ message: "Webhook processing failed. Please retry." });
  }

  // Always acknowledge with 200 so Razorpay stops retrying.
  return res.status(200).json({ received: true });
};


// ── Webhook event handlers ────────────────────────────────────────────────────


const handlePaymentCaptured = async (payment, io) => {
  if (!payment?.order_id || !payment?.id) {
    console.warn("Payment captured webhook: missing payment details.");
    return;
  }

  const order = await Order.findOne({
    "payment.razorpayOrderId": payment.order_id,
  }).populate("user", "name email");

  if (!order) {
    console.warn(
      `Webhook: no order found for Razorpay order ${payment.order_id}`
    );
    return;
  }

  // Never revive a cancelled order through a late payment webhook.
  if (order.status === "cancelled") {
    console.warn(
      `Webhook: payment captured for cancelled order ${order._id}. Manual reconciliation required.`
    );
    return;
  }

  // Ignore duplicate capture events after successful confirmation.
  if (order.payment.status === "paid" && order.stockDeducted) {
    console.log(
      `Webhook: order ${order._id} already paid and inventory deducted — skipping`
    );
    return;
  }

  // Verify that the captured payment belongs to the expected order.
  if (
    payment.order_id !== order.payment.razorpayOrderId ||
    payment.currency !== "INR" ||
    payment.amount !== order.totalP
  ) {
    console.error(
      `Webhook: payment details mismatch for order ${order._id}. Manual reconciliation required.`
    );
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

  // Release the reservation before marking payment as failed.
  if (order.stockReserved && !order.stockDeducted) {
    await releaseReservation(
      order.items,
      order._id,
      null,
      "payment_failure"
    );
  }

  order.payment.status = "failed";
  await order.save();

  console.log(`Webhook: marked payment failed for order ${order._id}`);
};


// ── Shared confirmation logic ─────────────────────────────────────────────────
const handleRefundProcessed = async (refund) => {
  if (!refund?.payment_id || !refund?.id) {
    throw new Error("Missing refund processed details.");
  }

  const order = await Order.findOne({
    "payment.razorpayPaymentId": refund.payment_id,
    "payment.method": "razorpay",
    status: "cancelled",
  });

  if (!order) {
    console.warn(
      `Refund processed webhook: no cancelled order found for payment ${refund.payment_id}`
    );
    return;
  }

  if (order.payment.refundStatus === "processed") {
    if (order.payment.razorpayRefundId !== refund.id) {
      throw new Error("Refund ID mismatch for an already processed refund.");
    }
    return;
  }

  if (
    refund.currency !== "INR" ||
    !Number.isSafeInteger(refund.amount) ||
    refund.amount !== order.payment.refundAmountP
  ) {
    throw new Error("Refund amount or currency mismatch.");
  }

  if (
    order.payment.razorpayRefundId &&
    order.payment.razorpayRefundId !== refund.id
  ) {
    throw new Error("Refund ID mismatch.");
  }

  // Restore inventory only when the matching reservation was deducted.
  await restoreStock(order.items, order._id, null);

  const updatedOrder = await Order.findOneAndUpdate(
    {
      _id: order._id,
      status: "cancelled",
      "payment.refundStatus": { $ne: "processed" },
      $or: [
        { "payment.razorpayRefundId": refund.id },
        { "payment.razorpayRefundId": null },
        { "payment.razorpayRefundId": { $exists: false } },
      ],
    },
    {
      $set: {
        "payment.razorpayRefundId": refund.id,
        "payment.refundStatus": "processed",
        "payment.status": "refunded",
        "payment.refundedAt": new Date(),
        "payment.refundFailureReason": null,
      },
    },
    { new: true }
  );

  if (!updatedOrder) {
    const latestOrder = await Order.findById(order._id);

    if (
      latestOrder?.payment.refundStatus === "processed" &&
      latestOrder.payment.razorpayRefundId === refund.id
    ) {
      return;
    }

    throw new Error("Could not update the order after refund processing.");
  }

  console.log(`Refund processed successfully for order ${order._id}`);
};


const handleRefundFailed = async (refund) => {
  if (!refund?.payment_id || !refund?.id) {
    throw new Error("Missing refund failure details.");
  }

  const order = await Order.findOne({
    "payment.razorpayPaymentId": refund.payment_id,
    "payment.method": "razorpay",
    status: "cancelled",
  });

  if (!order) {
    console.warn(
      `Refund failed webhook: no cancelled order found for payment ${refund.payment_id}`
    );
    return;
  }

  if (
    order.payment.razorpayRefundId &&
    order.payment.razorpayRefundId !== refund.id
  ) {
    throw new Error("Refund ID mismatch.");
  }

  if (order.payment.refundStatus === "processed") {
    console.log(
      `Ignoring delayed failed event for already processed refund ${refund.id}`
    );
    return;
  }

  const updatedOrder = await Order.findOneAndUpdate(
    {
      _id: order._id,
      status: "cancelled",
      "payment.refundStatus": { $ne: "processed" },
      $or: [
        { "payment.razorpayRefundId": refund.id },
        { "payment.razorpayRefundId": null },
        { "payment.razorpayRefundId": { $exists: false } },
      ],
    },
    {
      $set: {
        "payment.razorpayRefundId": refund.id,
        "payment.refundStatus": "failed",
        "payment.refundFailureReason":
          "Razorpay reported that the refund failed.",
      },
    },
    { new: true }
  );

  if (!updatedOrder) {
    const latestOrder = await Order.findById(order._id);

    if (latestOrder?.payment?.refundStatus === "processed") {
      return;
    }

    throw new Error("Could not safely update the failed refund.");
  }

  console.log(`Refund failed for order ${order._id}`);
};


// Called by verifyPayment (client) and handlePaymentCaptured (webhook).
// Idempotency:
//   - payment.status === "paid" check in callers prevents re-entry
//   - stockDeducted flag + findOneAndUpdate($set) prevents duplicate deductions



const confirmPayment = async (order, razorpayPaymentId, razorpaySignature, io) => {
  if (!order?._id || !razorpayPaymentId) {
    throw new Error("Missing order or payment details.");
  }

  // Atomically claim the order for payment processing.
  const lock = await Order.findOneAndUpdate(
    {
      _id: order._id,
      status: { $ne: "cancelled" },
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
    const latestOrder = await Order.findById(order._id);

    if (!latestOrder) {
      throw new Error("Order not found.");
    }

    if (latestOrder.status === "cancelled") {
      throw new Error("Cancelled orders cannot be confirmed.");
    }

    if (latestOrder.paymentProcessing) {
      const error = new Error(
        "Payment processing is already in progress for this order."
      );
      error.status = 409;
      throw error;
    }

    throw new Error("Unable to acquire payment processing lock.");
  }

  try {
    const currentOrder = await Order.findById(order._id).populate(
      "user",
      "name email"
    );

    if (!currentOrder || currentOrder.status === "cancelled") {
      throw new Error("Order cannot be confirmed.");
    }

    // Deduct inventory only if it has not already been deducted.
    if (!currentOrder.stockDeducted) {
      await deductStock(currentOrder.items, currentOrder._id, null);

      currentOrder.stockDeducted = true;
    }

    currentOrder.payment.status = "paid";
    currentOrder.payment.razorpayPaymentId = razorpayPaymentId;

    if (razorpaySignature) {
      currentOrder.payment.razorpaySignature = razorpaySignature;
    }

    if (!currentOrder.payment.paidAt) {
      currentOrder.payment.paidAt = new Date();
    }

    currentOrder.status = "confirmed";
    currentOrder.paymentProcessing = false;
    currentOrder.paymentProcessingAt = null;

    await currentOrder.save();

    // Update the original document reference for the caller.
    Object.assign(order, currentOrder.toObject());

    if (io) {
      io.to(`order_${currentOrder._id}`).emit("order_status_update", {
        orderId: currentOrder._id,
        status: "confirmed",
        updatedAt: new Date(),
      });
    }

    // Claim the confirmation email once.
    const emailClaim = await Order.findOneAndUpdate(
      {
        _id: currentOrder._id,
        orderConfirmationEmailSent: false,
      },
      {
        $set: { orderConfirmationEmailSent: true },
      },
      { returnDocument: "before" }
    );

    if (emailClaim && !emailClaim.orderConfirmationEmailSent) {
      sendOrderConfirmation(currentOrder).catch(async (err) => {
        console.error("Order confirmation email failed:", err.message);

        await Order.findOneAndUpdate(
          {
            _id: currentOrder._id,
            orderConfirmationEmailSent: true,
          },
          {
            $set: { orderConfirmationEmailSent: false },
          }
        ).catch(console.error);
      });
    }

    return true;
  } catch (err) {
    // Release the lock after an error so a safe retry can be attempted.
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
        "Could not release payment processing lock:",
        releaseError.message
      );
    });

    throw err;
  }
};



// ── POST /api/payments/cod-confirm ───────────────────────────────────────────

const confirmCOD = async (req, res) => {
  const { orderId } = req.body;

  if (!orderId) {
    return res.status(400).json({ message: "Order ID is required." });
  }

  const order = await Order.findById(orderId).populate("user", "name email");

  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }

  if (
    !order.user ||
    order.user._id.toString() !== req.user._id.toString()
  ) {
    return res.status(403).json({ message: "Not authorized" });
  }

  if (order.payment.method !== "cod") {
    return res.status(400).json({ message: "Not a COD order" });
  }

  if (order.status !== "pending") {
    return res.status(400).json({ message: "Order already processed" });
  }

  // Atomically acquire the order-processing lock.
  const lock = await Order.findOneAndUpdate(
    {
      _id: order._id,
      status: "pending",
      "payment.method": "cod",
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
      message: "This order is already being processed. Please try again.",
    });
  }

  try {
    const currentOrder = await Order.findById(order._id).populate(
      "user",
      "name email"
    );

    if (!currentOrder || currentOrder.status !== "pending") {
      throw Object.assign(
        new Error("Order is no longer pending."),
        { status: 409 }
      );
    }

    // Deduct inventory only if it has not already been deducted.
    if (!currentOrder.stockDeducted) {
      await deductStock(
        currentOrder.items,
        currentOrder._id,
        null
      );

      currentOrder.stockDeducted = true;
    }

    currentOrder.status = "confirmed";
    currentOrder.paymentProcessing = false;
    currentOrder.paymentProcessingAt = null;

    await currentOrder.save();

    if (req.io) {
      req.io.to(`order_${currentOrder._id}`).emit("order_status_update", {
        orderId: currentOrder._id,
        status: "confirmed",
        updatedAt: new Date(),
      });
    }

    return res.json({
      message: "COD order confirmed",
      order: orderResponse(currentOrder),
    });
  } catch (err) {
    console.error(
      `COD confirmation error for order ${order._id}:`,
      err.message
    );

    // Release the lock after failure so a safe retry can be attempted.
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
        "Could not release COD processing lock:",
        releaseError.message
      );
    });

    return res.status(err.status || 409).json({
      message:
        "COD order could not be confirmed because inventory deduction failed.",
    });
  }
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
  initiateFullRefund,
};