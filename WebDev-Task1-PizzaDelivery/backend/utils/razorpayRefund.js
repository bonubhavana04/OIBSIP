
const axios = require("axios");

const RAZORPAY_API_URL = "https://api.razorpay.com/v1";

const getCredentials = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error("Razorpay credentials are not configured.");
  }

  // This helper is intentionally restricted to Razorpay test keys.
  if (!keyId.startsWith("rzp_test_")) {
    throw new Error("Refund helper accepts test-mode Razorpay keys only.");
  }

  return { keyId, keySecret };
};

const createRefund = async ({
  paymentId,
  razorpayOrderId,
  amountP,
  idempotencyKey,
  orderId,
}) => {
  if (!paymentId || !razorpayOrderId || !amountP ||
      !idempotencyKey || !orderId) {
    throw new Error("Missing required refund details.");
  }

  if (!Number.isSafeInteger(amountP) || amountP <= 0) {
    throw new Error("Refund amount must be a positive integer in paise.");
  }

  if (
    typeof idempotencyKey !== "string" ||
    idempotencyKey.length < 10 ||
    !/^[a-zA-Z0-9_-]+$/.test(idempotencyKey)
  ) {
    throw new Error("Invalid refund idempotency key.");
  }

  const credentials = getCredentials();

  const config = {
    auth: {
      username: credentials.keyId,
      password: credentials.keySecret,
    },
    timeout: 15000,
  };

  // Verify the actual payment directly with Razorpay.
  const paymentResponse = await axios.get(
    `${RAZORPAY_API_URL}/payments/${encodeURIComponent(paymentId)}`,
    config
  );

  const payment = paymentResponse.data;

  if (payment.id !== paymentId) {
    throw new Error("Razorpay payment ID mismatch.");
  }

  if (payment.order_id !== razorpayOrderId) {
    throw new Error("Payment does not belong to this Razorpay order.");
  }

  if (payment.status !== "captured" || payment.captured !== true) {
    throw new Error("Only captured payments can be refunded.");
  }

  if (payment.currency !== "INR") {
    throw new Error("Only INR payments are supported.");
  }

  if (payment.amount !== amountP) {
    throw new Error("Refund amount does not match the captured payment.");
  }


  // Initiate the full refund with the persistent idempotency key.
  const refundResponse = await axios.post(
    `${RAZORPAY_API_URL}/payments/${encodeURIComponent(paymentId)}/refund`,
    {
      amount: amountP,
      notes: {
        orderId: String(orderId),
        reason: "customer_order_cancellation",
      },
    },
    {
      ...config,
      headers: {
        "Content-Type": "application/json",
        "X-Refund-Idempotency": idempotencyKey,
      },
    }
  );

  return refundResponse.data;
};

module.exports = { createRefund };
