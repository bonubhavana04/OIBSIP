
const router = require("express").Router();

const {
  getAllPizzas,
  getPizzaById,
  createPizza,
  updatePizza,
  deletePizza,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} = require("../controllers/pizzaController");

const { protect, optionalProtect, adminOnly } = require("../middleware/auth");

// Public menu browsing (optionalProtect lets admins see unavailable pizzas)
router.get("/categories", getCategories);
router.get("/", optionalProtect, getAllPizzas);
router.get("/:id", optionalProtect, getPizzaById);

// Admin-only category management
router.post("/categories", protect, adminOnly, createCategory);
router.put("/categories/:id", protect, adminOnly, updateCategory);
router.delete("/categories/:id", protect, adminOnly, deleteCategory);

// Admin-only pizza management
router.post("/", protect, adminOnly, createPizza);
router.put("/:id", protect, adminOnly, updatePizza);
router.delete("/:id", protect, adminOnly, deletePizza);

module.exports = router;
