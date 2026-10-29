const router = require("express").Router();
const {
  getAllPizzas, getPizzaById, createPizza, updatePizza, deletePizza,
  getCategories, createCategory, updateCategory, deleteCategory,
} = require("../controllers/pizzaController");
const { protect, adminOnly } = require("../middleware/auth");

// All pizza routes require a valid JWT
router.use(protect);

// Categories
router.get("/categories", getCategories);
router.post("/categories", adminOnly, createCategory);
router.put("/categories/:id", adminOnly, updateCategory);
router.delete("/categories/:id", adminOnly, deleteCategory);

// Pizzas
router.get("/", getAllPizzas);
router.get("/:id", getPizzaById);
router.post("/", adminOnly, createPizza);
router.put("/:id", adminOnly, updatePizza);
router.delete("/:id", adminOnly, deletePizza);

module.exports = router;
