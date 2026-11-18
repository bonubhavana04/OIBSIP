const router = require("express").Router();
const {
  getAll, getLowStock, getOne, create, update, remove,
  restock, adjust, getLogs, getAllLogs,
  getPizzaIngredients, setPizzaIngredients,
  triggerLowStockCheck,
} = require("../controllers/inventoryController");
const { protect, optionalProtect, adminOnly } = require("../middleware/auth");

// ── Public / authenticated ────────────────────────────────────────────────────
// Builder needs ingredient lists; optionalProtect populates req.user for the
// admin includeUnavailable check without blocking unauthenticated requests.
router.get("/", optionalProtect, getAll);

// ── Admin-only — must be before /:id to avoid route conflicts ─────────────────
router.get("/admin/low-stock",          protect, adminOnly, getLowStock);
router.get("/admin/logs",               protect, adminOnly, getAllLogs);
router.post("/admin/test-low-stock-alert", protect, adminOnly, triggerLowStockCheck);

// Pizza-ingredient recipe management
router.get( "/pizza/:pizzaId/ingredients", protect, adminOnly, getPizzaIngredients);
router.put( "/pizza/:pizzaId/ingredients", protect, adminOnly, setPizzaIngredients);

// ── Single item ───────────────────────────────────────────────────────────────
router.get("/:id",          getOne);
router.post("/",            protect, adminOnly, create);
router.put("/:id",          protect, adminOnly, update);
router.delete("/:id",       protect, adminOnly, remove);

// Stock mutation endpoints — separate from metadata update to enforce audit trail
router.put("/:id/restock",  protect, adminOnly, restock);   // increment
router.put("/:id/adjust",   protect, adminOnly, adjust);    // set absolute value

// Per-ingredient audit log
router.get("/:id/logs",     protect, adminOnly, getLogs);

module.exports = router;
