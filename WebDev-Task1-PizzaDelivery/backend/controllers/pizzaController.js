const Pizza    = require("../models/Pizza");
const Category = require("../models/Category");

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Normalise incoming size data from the client.
 * Accepts either { label, price } (rupees) or { label, priceP } (paise).
 * Always stores as priceP.
 */
const normaliseSizes = (sizes) =>
  sizes.map((s) => ({
    label:  s.label,
    priceP: s.priceP !== undefined ? s.priceP : Math.round(s.price * 100),
  }));

// ── PIZZA ─────────────────────────────────────────────────────────────────────

// GET /api/pizzas
const getAllPizzas = async (req, res) => {
  const { category, isVeg, isFeatured, search, sort } = req.query;
  const filter = { isAvailable: true };

  if (category)   filter.category   = category;
  if (isVeg !== undefined) filter.isVeg = isVeg === "true";
  if (isFeatured !== undefined) filter.isFeatured = isFeatured === "true";
  if (search)     filter.$text = { $search: search };

  const sortMap = {
    price_asc:  { "sizes.0.priceP": 1 },
    price_desc: { "sizes.0.priceP": -1 },
    rating:     { "ratings.average": -1 },
    newest:     { createdAt: -1 },
  };

  const pizzas = await Pizza.find(filter)
    .populate("category", "name emoji")
    .sort(sortMap[sort] || { createdAt: -1 });

  // Attach a `sizes` array with both priceP and price (rupees) for the frontend
  const result = pizzas.map((p) => {
    const obj = p.toObject();
    obj.sizes = obj.sizes.map((s) => ({ ...s, price: Math.round(s.priceP / 100) }));
    return obj;
  });

  res.json({ pizzas: result });
};

// GET /api/pizzas/:id
const getPizzaById = async (req, res) => {
  const pizza = await Pizza.findById(req.params.id).populate("category", "name emoji");
  if (!pizza) return res.status(404).json({ message: "Pizza not found" });

  const obj = pizza.toObject();
  obj.sizes = obj.sizes.map((s) => ({ ...s, price: Math.round(s.priceP / 100) }));
  res.json({ pizza: obj });
};

// POST /api/pizzas  [admin]
const createPizza = async (req, res) => {
  const body = { ...req.body };
  if (body.sizes) body.sizes = normaliseSizes(body.sizes);

  const pizza = await Pizza.create(body);
  await pizza.populate("category", "name emoji");
  res.status(201).json({ pizza });
};

// PUT /api/pizzas/:id  [admin]
const updatePizza = async (req, res) => {
  const body = { ...req.body };
  if (body.sizes) body.sizes = normaliseSizes(body.sizes);

  const pizza = await Pizza.findByIdAndUpdate(req.params.id, body, {
    returnDocument: "after", runValidators: true,
  }).populate("category", "name emoji");

  if (!pizza) return res.status(404).json({ message: "Pizza not found" });
  res.json({ pizza });
};

// DELETE /api/pizzas/:id  [admin]
const deletePizza = async (req, res) => {
  const pizza = await Pizza.findByIdAndDelete(req.params.id);
  if (!pizza) return res.status(404).json({ message: "Pizza not found" });
  res.json({ message: "Pizza deleted" });
};

// ── CATEGORY ──────────────────────────────────────────────────────────────────

// GET /api/pizzas/categories
const getCategories = async (req, res) => {
  const categories = await Category.find({ isActive: true }).sort({ name: 1 });
  res.json({ categories });
};

// POST /api/pizzas/categories  [admin]
const createCategory = async (req, res) => {
  const category = await Category.create(req.body);
  res.status(201).json({ category });
};

// PUT /api/pizzas/categories/:id  [admin]
const updateCategory = async (req, res) => {
  const category = await Category.findByIdAndUpdate(req.params.id, req.body, {
    returnDocument: "after", runValidators: true,
  });
  if (!category) return res.status(404).json({ message: "Category not found" });
  res.json({ category });
};

// DELETE /api/pizzas/categories/:id  [admin]
const deleteCategory = async (req, res) => {
  const inUse = await Pizza.exists({ category: req.params.id });
  if (inUse) return res.status(400).json({ message: "Category has pizzas — cannot delete" });
  await Category.findByIdAndDelete(req.params.id);
  res.json({ message: "Category deleted" });
};

module.exports = {
  getAllPizzas, getPizzaById, createPizza, updatePizza, deletePizza,
  getCategories, createCategory, updateCategory, deleteCategory,
};
