/**
 * seedInventory.js — seeds builder ingredient inventory.
 * Run: node seedInventory.js
 *
 * Prices are stored in PAISE.  ₹0 = 0, ₹20 = 2000, ₹50 = 5000.
 * stock: -1 means unlimited (not tracked).
 */
require("dotenv").config();
const mongoose  = require("mongoose");
const Inventory = require("./models/Inventory");

const items = [
  // ── BASES (5) ──────────────────────────────────────────────────────────────
  {
    category: "base", sortOrder: 1,
    name: "Classic Hand-Tossed",
    description: "Light & airy with a chewy crust",
    emoji: "🫓", priceP: 0, stock: -1,
  },
  {
    category: "base", sortOrder: 2,
    name: "Thin & Crispy",
    description: "Ultra-thin Roman-style base",
    emoji: "🥙", priceP: 0, stock: -1,
  },
  {
    category: "base", sortOrder: 3,
    name: "Thick Pan",
    description: "Deep-dish, pillowy soft",
    emoji: "🍞", priceP: 3000, stock: -1,   // +₹30
  },
  {
    category: "base", sortOrder: 4,
    name: "Whole Wheat",
    description: "Nutty, wholesome & healthy",
    emoji: "🌾", priceP: 2000, stock: -1,   // +₹20
  },
  {
    category: "base", sortOrder: 5,
    name: "Gluten-Free",
    description: "Rice flour base, crisp finish",
    emoji: "🌿", priceP: 5000, stock: -1,   // +₹50
  },

  // ── SAUCES (5) ─────────────────────────────────────────────────────────────
  {
    category: "sauce", sortOrder: 1,
    name: "Classic Tomato",
    description: "San Marzano tomatoes, garlic, basil",
    emoji: "🍅", priceP: 0, stock: -1,
  },
  {
    category: "sauce", sortOrder: 2,
    name: "BBQ Smoky",
    description: "Rich, tangy hickory BBQ",
    emoji: "🔥", priceP: 0, stock: -1,
  },
  {
    category: "sauce", sortOrder: 3,
    name: "White Garlic",
    description: "Creamy roasted garlic alfredo",
    emoji: "🧄", priceP: 2000, stock: -1,   // +₹20
  },
  {
    category: "sauce", sortOrder: 4,
    name: "Pesto",
    description: "Fresh basil & pine nut pesto",
    emoji: "🌿", priceP: 3000, stock: -1,   // +₹30
  },
  {
    category: "sauce", sortOrder: 5,
    name: "Spicy Arrabbiata",
    description: "Fiery chilli tomato sauce",
    emoji: "🌶️", priceP: 1000, stock: -1,  // +₹10
  },

  // ── CHEESES (5) ────────────────────────────────────────────────────────────
  {
    category: "cheese", sortOrder: 1,
    name: "Mozzarella",
    description: "Classic stretchy melt",
    emoji: "🧀", priceP: 0, stock: -1,
  },
  {
    category: "cheese", sortOrder: 2,
    name: "Cheddar",
    description: "Sharp, bold flavour",
    emoji: "🧀", priceP: 2000, stock: -1,   // +₹20
  },
  {
    category: "cheese", sortOrder: 3,
    name: "Parmesan",
    description: "Aged, nutty & salty",
    emoji: "🧀", priceP: 3000, stock: -1,   // +₹30
  },
  {
    category: "cheese", sortOrder: 4,
    name: "Vegan Cheese",
    description: "Cashew-based, dairy-free",
    emoji: "🌱", priceP: 4000, stock: -1,   // +₹40
  },
  {
    category: "cheese", sortOrder: 5,
    name: "Four Cheese Blend",
    description: "Mozz + Ched + Parm + Gouda",
    emoji: "🧀", priceP: 5000, stock: -1,   // +₹50
  },

  // ── VEGGIES (10) ───────────────────────────────────────────────────────────
  { category: "veggie", sortOrder: 1,  name: "Bell Peppers",       emoji: "🫑", priceP: 2000, stock: -1 },
  { category: "veggie", sortOrder: 2,  name: "Mushrooms",          emoji: "🍄", priceP: 2500, stock: -1 },
  { category: "veggie", sortOrder: 3,  name: "Black Olives",       emoji: "🫒", priceP: 2000, stock: -1 },
  { category: "veggie", sortOrder: 4,  name: "Red Onions",         emoji: "🧅", priceP: 1500, stock: -1 },
  { category: "veggie", sortOrder: 5,  name: "Jalapeños",          emoji: "🌶️", priceP: 2000, stock: -1 },
  { category: "veggie", sortOrder: 6,  name: "Corn",               emoji: "🌽", priceP: 1500, stock: -1 },
  { category: "veggie", sortOrder: 7,  name: "Spinach",            emoji: "🥬", priceP: 2000, stock: -1 },
  { category: "veggie", sortOrder: 8,  name: "Sun-dried Tomatoes", emoji: "🍅", priceP: 3000, stock: -1 },
  { category: "veggie", sortOrder: 9,  name: "Artichoke Hearts",   emoji: "🌿", priceP: 3500, stock: -1 },
  { category: "veggie", sortOrder: 10, name: "Caramelised Onions", emoji: "🧅", priceP: 2500, stock: -1 },
];

const seed = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  // Upsert by name+category so re-running is safe
  let created = 0, updated = 0;
  for (const item of items) {
    const result = await Inventory.findOneAndUpdate(
      { name: item.name, category: item.category },
      { $set: item },
      { upsert: true, returnDocument: "after", runValidators: true }
    );
    if (result.createdAt.getTime() === result.updatedAt.getTime()) created++;
    else updated++;
  }

  console.log(`✅  Inventory seeded — ${created} created, ${updated} updated`);
  console.log(`   Bases: 5 | Sauces: 5 | Cheeses: 5 | Veggies: 10`);
  process.exit(0);
};

seed().catch((err) => {
  console.error("Seed error:", err.message);
  process.exit(1);
});
