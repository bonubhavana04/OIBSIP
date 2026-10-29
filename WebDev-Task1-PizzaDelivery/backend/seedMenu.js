/**
 * seedMenu.js — seeds pizza categories and menu pizzas.
 * Run: node seedMenu.js
 *
 * Prices are stored in PAISE (integer).  ₹199 → 19900.
 */
require("dotenv").config();
const mongoose = require("mongoose");
const Category = require("./models/Category");
const Pizza    = require("./models/Pizza");

const categories = [
  { name: "Classic",  emoji: "🍕", description: "Timeless favourites everyone loves" },
  { name: "Veggie",   emoji: "🥦", description: "Fresh garden goodness" },
  { name: "Non-Veg",  emoji: "🍗", description: "Loaded with premium meats" },
  { name: "Premium",  emoji: "👨‍🍳", description: "Gourmet toppings, elevated flavours" },
];

// Helper: convert rupee price to paise
const p = (rupees) => rupees * 100;

const seed = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  await Pizza.deleteMany({});
  await Category.deleteMany({});

  const cats   = await Category.insertMany(categories);
  const byName = Object.fromEntries(cats.map((c) => [c.name, c._id]));

  const pizzas = [
    // ── Classic ──────────────────────────────────────────────────────────────
    {
      name: "Margherita",
      description: "San Marzano tomato, fresh mozzarella, basil",
      category: byName["Classic"],
      sizes: [
        { label: "Small",  priceP: p(199) },
        { label: "Medium", priceP: p(299) },
        { label: "Large",  priceP: p(399) },
      ],
      toppings: ["Mozzarella", "Basil", "Olive Oil"],
      isVeg: true, isFeatured: true,
    },
    {
      name: "Pepperoni Classic",
      description: "Loaded with spicy pepperoni and mozzarella",
      category: byName["Classic"],
      sizes: [
        { label: "Small",  priceP: p(249) },
        { label: "Medium", priceP: p(349) },
        { label: "Large",  priceP: p(449) },
      ],
      toppings: ["Pepperoni", "Mozzarella", "Tomato Sauce"],
      isVeg: false, isFeatured: true,
    },
    {
      name: "BBQ Chicken",
      description: "Smoky BBQ sauce, grilled chicken, red onions",
      category: byName["Classic"],
      sizes: [
        { label: "Small",  priceP: p(269) },
        { label: "Medium", priceP: p(369) },
        { label: "Large",  priceP: p(469) },
      ],
      toppings: ["Grilled Chicken", "BBQ Sauce", "Red Onion", "Mozzarella"],
      isVeg: false,
    },
    // ── Veggie ────────────────────────────────────────────────────────────────
    {
      name: "Garden Fresh",
      description: "Bell peppers, mushrooms, olives, onions, tomatoes",
      category: byName["Veggie"],
      sizes: [
        { label: "Small",  priceP: p(219) },
        { label: "Medium", priceP: p(319) },
        { label: "Large",  priceP: p(419) },
      ],
      toppings: ["Bell Peppers", "Mushrooms", "Olives", "Onions", "Tomatoes"],
      isVeg: true, isFeatured: true,
    },
    {
      name: "Paneer Tikka",
      description: "Tandoori paneer, capsicum, onion, mint chutney base",
      category: byName["Veggie"],
      sizes: [
        { label: "Small",  priceP: p(239) },
        { label: "Medium", priceP: p(339) },
        { label: "Large",  priceP: p(439) },
      ],
      toppings: ["Paneer", "Capsicum", "Onion", "Mint Chutney"],
      isVeg: true,
    },
    {
      name: "Mushroom Melt",
      description: "Three-mushroom blend, truffle oil, parmesan",
      category: byName["Veggie"],
      sizes: [
        { label: "Small",  priceP: p(229) },
        { label: "Medium", priceP: p(329) },
        { label: "Large",  priceP: p(429) },
      ],
      toppings: ["Button Mushrooms", "Shiitake", "Portobello", "Parmesan"],
      isVeg: true,
    },
    // ── Non-Veg ───────────────────────────────────────────────────────────────
    {
      name: "Chicken Supreme",
      description: "Grilled chicken, jalapeños, corn, mozzarella",
      category: byName["Non-Veg"],
      sizes: [
        { label: "Small",  priceP: p(259) },
        { label: "Medium", priceP: p(359) },
        { label: "Large",  priceP: p(459) },
      ],
      toppings: ["Grilled Chicken", "Jalapeños", "Corn", "Mozzarella"],
      isVeg: false, isFeatured: true,
    },
    {
      name: "Meat Feast",
      description: "Pepperoni, chicken sausage, bacon, ham",
      category: byName["Non-Veg"],
      sizes: [
        { label: "Small",  priceP: p(299) },
        { label: "Medium", priceP: p(399) },
        { label: "Large",  priceP: p(499) },
      ],
      toppings: ["Pepperoni", "Chicken Sausage", "Bacon", "Ham"],
      isVeg: false,
    },
    {
      name: "Spicy Keema",
      description: "Minced chicken, green chillies, coriander, onion",
      category: byName["Non-Veg"],
      sizes: [
        { label: "Small",  priceP: p(269) },
        { label: "Medium", priceP: p(369) },
        { label: "Large",  priceP: p(469) },
      ],
      toppings: ["Minced Chicken", "Green Chillies", "Coriander", "Onion"],
      isVeg: false,
    },
    // ── Premium ───────────────────────────────────────────────────────────────
    {
      name: "Truffle Royale",
      description: "Black truffle paste, wild mushrooms, arugula, parmesan",
      category: byName["Premium"],
      sizes: [
        { label: "Small",  priceP: p(349) },
        { label: "Medium", priceP: p(499) },
        { label: "Large",  priceP: p(649) },
      ],
      toppings: ["Black Truffle", "Wild Mushrooms", "Arugula", "Parmesan"],
      isVeg: true, isFeatured: true,
    },
    {
      name: "Prawn Aglio",
      description: "Garlic butter prawns, cherry tomatoes, chilli flakes",
      category: byName["Premium"],
      sizes: [
        { label: "Small",  priceP: p(379) },
        { label: "Medium", priceP: p(529) },
        { label: "Large",  priceP: p(679) },
      ],
      toppings: ["Prawns", "Garlic Butter", "Cherry Tomatoes", "Chilli Flakes"],
      isVeg: false,
    },
    {
      name: "Smoked Salmon",
      description: "Cream cheese base, smoked salmon, capers, dill",
      category: byName["Premium"],
      sizes: [
        { label: "Small",  priceP: p(399) },
        { label: "Medium", priceP: p(549) },
        { label: "Large",  priceP: p(699) },
      ],
      toppings: ["Smoked Salmon", "Cream Cheese", "Capers", "Dill"],
      isVeg: false,
    },
  ];

  await Pizza.insertMany(pizzas);
  console.log(`✅  Seeded ${categories.length} categories and ${pizzas.length} pizzas`);
  process.exit(0);
};

seed().catch((err) => {
  console.error("Seed error:", err.message);
  process.exit(1);
});
