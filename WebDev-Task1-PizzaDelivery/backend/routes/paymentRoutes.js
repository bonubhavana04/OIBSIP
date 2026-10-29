const express = require("express");
const router  = express.Router();
const {
  createRazorpayOrder,
  verifyPayment,
  handleWebhook,
  confirmCOD,
  getPaymentStatus,
} = require("../controllers/paymentController");
const { protect } = require("../middleware/auth");

// ── Webhook — MUST be before express.json() and before protect middleware ─────
// express.raw() captures the raw Buffer so we can verify the Razorpay signature
// against the exact bytes Razorpay signed.  JSON.parse happens inside the handler.
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  handleWebhook
);

// ── All other payment routes require a valid JWT ──────────────────────────────
router.use(protect);

router.post("/create-order", createRazorpayOrder);
router.post("/verify",       verifyPayment);
router.post("/cod-confirm",  confirmCOD);
router.get( "/status/:orderId", getPaymentStatus);

module.exports = router;
