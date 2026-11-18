/**
 * seedInventory.js — seeds builder ingredient inventory.
 * Run: node seedInventory.js
 *
 * Prices stored in PAISE. ₹0 = 0, ₹20 = 2000, ₹50 = 5000.
 * stock: -1 means unlimited (not tracked).
 * Safe to re-run: upserts by name+category.
 */
require("dotenv").config();
const mongoose  = require("mongoose");
const Inventory = require("./models/Inventory");

const items = [
  // ── BASES (8) ──────────────────────────────────────────────────────────────
  { category: "base", sortOrder: 1,  name: "Classic Hand Tossed",  description: "Light & airy with a chewy crust",           emoji: "🫓", priceP: 0,    stock: -1 },
  { category: "base", sortOrder: 2,  name: "Thin Crust",           description: "Ultra-thin Roman-style base",               emoji: "🥙", priceP: 0,    stock: -1 },
  { category: "base", sortOrder: 3,  name: "Pan Crust",            description: "Deep-dish, pillowy soft",                   emoji: "🍞", priceP: 3000, stock: -1 },
  { category: "base", sortOrder: 4,  name: "Whole Wheat",          description: "Nutty, wholesome & healthy",                emoji: "🌾", priceP: 2000, stock: -1 },
  { category: "base", sortOrder: 5,  name: "Multigrain",           description: "Seeds & grains for extra nutrition",        emoji: "🌿", priceP: 2500, stock: -1 },
  { category: "base", sortOrder: 6,  name: "Cheese Burst",         description: "Crust stuffed with molten mozzarella",      emoji: "🧀", priceP: 5000, stock: -1 },
  { category: "base", sortOrder: 7,  name: "Stuffed Crust",        description: "Classic crust filled with cheese",          emoji: "🫓", priceP: 4000, stock: -1 },
  { category: "base", sortOrder: 8,  name: "Gluten-Free",          description: "Rice flour base, crisp finish — contains no gluten", emoji: "🌱", priceP: 6000, stock: -1 },

  // ── SAUCES (10) ────────────────────────────────────────────────────────────
  { category: "sauce", sortOrder: 1,  name: "Classic Tomato",   description: "San Marzano tomatoes, garlic, basil",       emoji: "🍅", priceP: 0,    stock: -1 },
  { category: "sauce", sortOrder: 2,  name: "Marinara",         description: "Rustic tomato, oregano, olive oil",         emoji: "🍅", priceP: 0,    stock: -1 },
  { category: "sauce", sortOrder: 3,  name: "Pesto",            description: "Fresh basil & pine nut pesto",              emoji: "🌿", priceP: 3000, stock: -1 },
  { category: "sauce", sortOrder: 4,  name: "BBQ",              description: "Rich, tangy hickory BBQ",                   emoji: "🔥", priceP: 0,    stock: -1 },
  { category: "sauce", sortOrder: 5,  name: "White Garlic",     description: "Creamy roasted garlic alfredo",             emoji: "🧄", priceP: 2000, stock: -1 },
  { category: "sauce", sortOrder: 6,  name: "Alfredo",          description: "Buttery parmesan cream sauce",              emoji: "🧄", priceP: 2500, stock: -1 },
  { category: "sauce", sortOrder: 7,  name: "Peri Peri",        description: "Fiery African bird's eye chilli sauce",     emoji: "🌶️", priceP: 1500, stock: -1 },
  { category: "sauce", sortOrder: 8,  name: "Schezwan",         description: "Bold Indo-Chinese chilli garlic sauce",     emoji: "🌶️", priceP: 1500, stock: -1 },
  { category: "sauce", sortOrder: 9,  name: "Tandoori",         description: "Smoky tandoori masala sauce",               emoji: "🫙", priceP: 2000, stock: -1 },
  { category: "sauce", sortOrder: 10, name: "Chilli Garlic",    description: "Fiery chilli tomato with roasted garlic",   emoji: "🌶️", priceP: 1000, stock: -1 },

  // ── CHEESES (8) ────────────────────────────────────────────────────────────
  { category: "cheese", sortOrder: 1, name: "Mozzarella",       description: "Classic stretchy melt",                     emoji: "🧀", priceP: 0,    stock: -1 },
  { category: "cheese", sortOrder: 2, name: "Cheddar",          description: "Sharp, bold flavour",                       emoji: "🧀", priceP: 2000, stock: -1 },
  { category: "cheese", sortOrder: 3, name: "Parmesan",         description: "Aged, nutty & salty",                       emoji: "🧀", priceP: 3000, stock: -1 },
  { category: "cheese", sortOrder: 4, name: "Feta",             description: "Crumbly, tangy Greek cheese",               emoji: "🧀", priceP: 3500, stock: -1 },
  { category: "cheese", sortOrder: 5, name: "Gouda",            description: "Mild, creamy Dutch cheese",                 emoji: "🧀", priceP: 3000, stock: -1 },
  { category: "cheese", sortOrder: 6, name: "Processed Cheese", description: "Smooth, mild and melty",                    emoji: "🧀", priceP: 1500, stock: -1 },
  { category: "cheese", sortOrder: 7, name: "Cream Cheese",     description: "Rich, velvety cream cheese spread",         emoji: "🧀", priceP: 3000, stock: -1 },
  { category: "cheese", sortOrder: 8, name: "Vegan Cheese",     description: "Cashew-based, dairy-free alternative",      emoji: "🌱", priceP: 5000, stock: -1 },

  // ── VEGGIES & VEGETARIAN TOPPINGS (16) ────────────────────────────────────
  { category: "veggie", sortOrder: 1,  name: "Onion",              description: "Sliced red or white onion",               emoji: "🧅", priceP: 1500, stock: -1 },
  { category: "veggie", sortOrder: 2,  name: "Capsicum",           description: "Green capsicum (bell pepper)",            emoji: "🫑", priceP: 2000, stock: -1 },
  { category: "veggie", sortOrder: 3,  name: "Green Bell Pepper",  description: "Fresh green bell pepper",                 emoji: "🫑", priceP: 2000, stock: -1 },
  { category: "veggie", sortOrder: 4,  name: "Red Bell Pepper",    description: "Sweet red bell pepper",                   emoji: "🫑", priceP: 2000, stock: -1 },
  { category: "veggie", sortOrder: 5,  name: "Yellow Bell Pepper", description: "Mild yellow bell pepper",                 emoji: "🫑", priceP: 2000, stock: -1 },
  { category: "veggie", sortOrder: 6,  name: "Sweet Corn",         description: "Tender sweet corn kernels",               emoji: "🌽", priceP: 1500, stock: -1 },
  { category: "veggie", sortOrder: 7,  name: "Mushroom",           description: "Sliced button mushrooms",                 emoji: "🍄", priceP: 2500, stock: -1 },
  { category: "veggie", sortOrder: 8,  name: "Black Olives",       description: "Sliced black olives",                     emoji: "🫒", priceP: 2000, stock: -1 },
  { category: "veggie", sortOrder: 9,  name: "Green Olives",       description: "Sliced green olives",                     emoji: "🫒", priceP: 2000, stock: -1 },
  { category: "veggie", sortOrder: 10, name: "Jalapeños",          description: "Pickled jalapeño slices — spicy",         emoji: "🌶️", priceP: 2000, stock: -1 },
  { category: "veggie", sortOrder: 11, name: "Tomato",             description: "Fresh sliced tomato",                     emoji: "🍅", priceP: 1500, stock: -1 },
  { category: "veggie", sortOrder: 12, name: "Cherry Tomato",      description: "Halved cherry tomatoes",                  emoji: "🍅", priceP: 2000, stock: -1 },
  { category: "veggie", sortOrder: 13, name: "Spinach",            description: "Fresh baby spinach leaves",               emoji: "🥬", priceP: 2000, stock: -1 },
  { category: "veggie", sortOrder: 14, name: "Broccoli",           description: "Blanched broccoli florets",               emoji: "🥦", priceP: 2500, stock: -1 },
  { category: "veggie", sortOrder: 15, name: "Pineapple",          description: "Sweet pineapple chunks",                  emoji: "🍍", priceP: 2000, stock: -1 },
  { category: "veggie", sortOrder: 16, name: "Paneer",             description: "Fresh Indian cottage cheese cubes",       emoji: "🧊", priceP: 4000, stock: -1 },
];

const seed = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  let created = 0, updated = 0;
  for (const item of items) {
    const before = await Inventory.findOne({ name: item.name, category: item.category });
    await Inventory.findOneAndUpdate(
      { name: item.name, category: item.category },
      { $set: item },
      { upsert: true, returnDocument: "after", runValidators: true }
    );
    if (before) updated++; else created++;
  }

  const bases    = items.filter((i) => i.category === "base").length;
  const sauces   = items.filter((i) => i.category === "sauce").length;
  const cheeses  = items.filter((i) => i.category === "cheese").length;
  const veggies  = items.filter((i) => i.category === "veggie").length;

  console.log(`✅  Inventory seeded — ${created} created, ${updated} updated`);
  console.log(`   Bases: ${bases} | Sauces: ${sauces} | Cheeses: ${cheeses} | Veggies: ${veggies}`);
  process.exit(0);
};

seed().catch((err) => {
  console.error("Seed error:", err.message);
  process.exit(1);
});
