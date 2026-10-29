const Inventory       = require("../models/Inventory");
const InventoryLog    = require("../models/InventoryLog");
const PizzaIngredient = require("../models/PizzaIngredient");
const { adjustStock, addStock } = require("../utils/inventoryService");

const CATEGORIES = ["base", "sauce", "cheese", "veggie"];

// ── GET /api/inventory ────────────────────────────────────────────────────────
const getAll = async (req, res) => {
  const { category, includeUnavailable } = req.query;
  const filter = {};

  // Non-admins only see available items
  if (req.user?.role !== "admin" || includeUnavailable !== "true") {
    filter.isAvailable = true;
  }

  if (category) {
    if (!CATEGORIES.includes(category))
      return res.status(400).json({ message: `category must be one of: ${CATEGORIES.join(", ")}` });
    filter.category = category;
  }

  const items = await Inventory.find(filter).sort({ category: 1, sortOrder: 1, name: 1 });

  const grouped = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = items
      .filter((i) => i.category === cat)
      .map((i) => i.toObject({ virtuals: true }));
    return acc;
  }, {});

  res.json({ items, grouped });
};

// ── GET /api/inventory/admin/low-stock  [admin] ───────────────────────────────
const getLowStock = async (req, res) => {
  const lowStock = await Inventory.aggregate([
    { $match: { stock: { $gte: 0 } } },
    { $match: { $expr: { $lte: ["$stock", "$lowStockThreshold"] } } },
    { $sort: { stock: 1 } },
  ]);
  res.json({ items: lowStock });
};

// ── GET /api/inventory/:id ────────────────────────────────────────────────────
const getOne = async (req, res) => {
  const item = await Inventory.findById(req.params.id);
  if (!item) return res.status(404).json({ message: "Inventory item not found" });
  res.json({ item: item.toObject({ virtuals: true }) });
};

// ── POST /api/inventory  [admin] ──────────────────────────────────────────────
const create = async (req, res) => {
  const body = { ...req.body };
  if (body.price !== undefined && body.priceP === undefined) {
    body.priceP = Math.round(body.price * 100);
    delete body.price;
  }
  const item = await Inventory.create(body);
  res.status(201).json({ item });
};

// ── PUT /api/inventory/:id  [admin] ───────────────────────────────────────────
// Updates metadata (name, description, priceP, isAvailable, etc.)
// Does NOT update stock directly — use /adjust or /restock for that.
const update = async (req, res) => {
  const body = { ...req.body };
  if (body.price !== undefined && body.priceP === undefined) {
    body.priceP = Math.round(body.price * 100);
    delete body.price;
  }
  // Prevent accidental stock mutation through this endpoint
  delete body.stock;
  delete body.reservedStock;

  const item = await Inventory.findByIdAndUpdate(req.params.id, body, {
    returnDocument: "after", runValidators: true,
  });
  if (!item) return res.status(404).json({ message: "Inventory item not found" });
  res.json({ item });
};

// ── DELETE /api/inventory/:id  [admin] ────────────────────────────────────────
const remove = async (req, res) => {
  const item = await Inventory.findByIdAndDelete(req.params.id);
  if (!item) return res.status(404).json({ message: "Inventory item not found" });
  res.json({ message: "Inventory item deleted" });
};

// ── PUT /api/inventory/:id/restock  [admin] ───────────────────────────────────
// Adds qty units to current stock (increment).
const restock = async (req, res) => {
  const { quantity, note } = req.body;
  if (!Number.isInteger(quantity) || quantity <= 0)
    return res.status(400).json({ message: "quantity must be a positive integer" });

  const item = await addStock(req.params.id, quantity, req.user._id, note || "Admin restock");
  res.json({ item, message: `Restocked by ${quantity} units` });
};

// ── PUT /api/inventory/:id/adjust  [admin] ────────────────────────────────────
// Sets stock to an absolute value (-1 = unlimited).
const adjust = async (req, res) => {
  const { stock, note } = req.body;
  if (stock === undefined)
    return res.status(400).json({ message: "stock is required" });
  if (!Number.isInteger(stock) || stock < -1)
    return res.status(400).json({ message: "stock must be an integer >= -1 (use -1 for unlimited)" });

  const item = await adjustStock(req.params.id, stock, req.user._id, note || "Admin manual adjustment");
  res.json({ item, message: `Stock set to ${stock}` });
};

// ── GET /api/inventory/:id/logs  [admin] ──────────────────────────────────────
const getLogs = async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const [logs, total] = await Promise.all([
    InventoryLog.find({ ingredient: req.params.id })
      .populate("performedBy", "name email")
      .populate("order", "_id")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    InventoryLog.countDocuments({ ingredient: req.params.id }),
  ]);

  res.json({ logs, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
};

// ── GET /api/inventory/admin/logs  [admin] ────────────────────────────────────
// All logs across all ingredients, paginated.
const getAllLogs = async (req, res) => {
  const { page = 1, limit = 50, reason, ingredientId } = req.query;
  const filter = {};
  if (reason)       filter.reason = reason;
  if (ingredientId) filter.ingredient = ingredientId;

  const skip = (Number(page) - 1) * Number(limit);

  const [logs, total] = await Promise.all([
    InventoryLog.find(filter)
      .populate("ingredient", "name category")
      .populate("performedBy", "name email")
      .populate("order", "_id")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    InventoryLog.countDocuments(filter),
  ]);

  res.json({ logs, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
};

// ── Pizza-ingredient recipe endpoints ─────────────────────────────────────────

// GET /api/inventory/pizza/:pizzaId/ingredients  [admin]
const getPizzaIngredients = async (req, res) => {
  const recipe = await PizzaIngredient.find({ pizza: req.params.pizzaId })
    .populate("ingredient", "name category emoji stock reservedStock isAvailable");
  res.json({ recipe });
};

// PUT /api/inventory/pizza/:pizzaId/ingredients  [admin]
// Body: { ingredients: [{ ingredientId, qty }] }
// Replaces the entire recipe for the pizza.
const setPizzaIngredients = async (req, res) => {
  const { ingredients } = req.body;
  if (!Array.isArray(ingredients))
    return res.status(400).json({ message: "ingredients must be an array" });

  for (const entry of ingredients) {
    if (!entry.ingredientId)
      return res.status(400).json({ message: "Each entry must have ingredientId" });
    if (!Number.isInteger(entry.qty) || entry.qty < 1)
      return res.status(400).json({ message: "qty must be a positive integer" });
  }

  // Validate all ingredient IDs exist
  const ids   = ingredients.map((e) => e.ingredientId);
  const found = await Inventory.find({ _id: { $in: ids } }).select("_id");
  if (found.length !== ids.length) {
    const foundSet = new Set(found.map((d) => d._id.toString()));
    const missing  = ids.filter((id) => !foundSet.has(id.toString()));
    return res.status(400).json({ message: `Unknown ingredient IDs: ${missing.join(", ")}` });
  }

  // Replace recipe: delete existing, insert new
  await PizzaIngredient.deleteMany({ pizza: req.params.pizzaId });

  const docs = ingredients.map((e) => ({
    pizza:      req.params.pizzaId,
    ingredient: e.ingredientId,
    qty:        e.qty,
  }));

  const recipe = docs.length > 0 ? await PizzaIngredient.insertMany(docs) : [];
  res.json({ recipe, message: `Recipe updated — ${recipe.length} ingredient(s) set` });
};

module.exports = {
  getAll, getLowStock, getOne, create, update, remove,
  restock, adjust, getLogs, getAllLogs,
  getPizzaIngredients, setPizzaIngredients,
};
