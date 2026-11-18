const router = require("express").Router();
const {
  placeOrder, getOrders, getOrderById, updateOrderStatus, cancelOrder, getStats,
} = require("../controllers/orderController");
const { protect, adminOnly, requireVerified } = require("../middleware/auth");

router.use(protect);

// Admin stats — must be before /:id to avoid route conflict
router.get("/admin/stats", adminOnly, getStats);

// Placing an order requires a verified email
router.post("/", requireVerified, placeOrder);

router.get("/",      getOrders);
router.get("/:id",   getOrderById);
router.put("/:id/status", adminOnly, updateOrderStatus);
router.put("/:id/cancel", cancelOrder);

module.exports = router;
