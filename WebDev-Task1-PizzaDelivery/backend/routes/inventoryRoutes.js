const router = require("express").Router();
const {
  getAll, getLowStock, getOne, create, update, remove,
  restock, adjust, getLogs, getAllLogs,
  getPizzaIngredients, setPizzaIngredients,
} = require("../controllers/inventoryController");
const { protect, adminOnly } = require("../middleware/auth");

// ── Public / authenticated ────────────────────────────────────────────────────
// Builder needs ingredient lists; auth is optional (getAll checks req.user internally)
router.get("/", getAll);

// ── Admin-only — must be before /:id to avoid route conflicts ─────────────────
router.get("/admin/low-stock", protect, adminOnly, getLowStock);
router.get("/admin/logs",      protect, adminOnly, getAllLogs);

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
