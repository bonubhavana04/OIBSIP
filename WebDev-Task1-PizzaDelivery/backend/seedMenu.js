/**
 * seedMenu.js — seeds pizza categories and menu pizzas.
 * Run: node seedMenu.js
 *
 * Prices stored in PAISE (integer). ₹199 → 19900.
 * Safe to re-run: deletes existing pizzas and categories first.
 */
require("dotenv").config();
const mongoose = require("mongoose");
const Category = require("./models/Category");
const Pizza    = require("./models/Pizza");

const p = (rupees) => rupees * 100;

const categories = [
  { name: "Classic Pizzas",          emoji: "🍕",  description: "Timeless favourites everyone loves" },
  { name: "Vegetarian Pizzas",       emoji: "🥦",  description: "Fresh garden goodness, 100% veg" },
  { name: "Indian Fusion Pizzas",    emoji: "🌶️", description: "Bold Indian flavours on a pizza base" },
  { name: "Spicy Pizzas",            emoji: "🔥",  description: "Turn up the heat" },
  { name: "Non-Vegetarian Pizzas",   emoji: "🍗",  description: "Loaded with premium meats" },
  { name: "Premium Pizzas",          emoji: "👨‍🍳", description: "Gourmet toppings, elevated flavours" },
  { name: "International Pizzas",    emoji: "🌍",  description: "World flavours on one crust" },
];

const seed = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  await Pizza.deleteMany({});
  await Category.deleteMany({});

  const cats   = await Category.insertMany(categories);
  const by     = Object.fromEntries(cats.map((c) => [c.name, c._id]));

  const pizzas = [
    // ── Classic Pizzas ────────────────────────────────────────────────────────
    {
      name: "Margherita",
      description: "San Marzano tomato, fresh mozzarella, fragrant basil — the original.",
      category: by["Classic Pizzas"],
      sizes: [{ label: "Small", priceP: p(199) }, { label: "Medium", priceP: p(299) }, { label: "Large", priceP: p(399) }],
      toppings: ["Mozzarella", "Basil", "Olive Oil"],
      isVeg: true, isFeatured: true, isBestseller: true, spiceLevel: "mild",
    },
    {
      name: "Double Cheese Margherita",
      description: "Classic Margherita loaded with an extra layer of stretchy mozzarella.",
      category: by["Classic Pizzas"],
      sizes: [{ label: "Small", priceP: p(229) }, { label: "Medium", priceP: p(329) }, { label: "Large", priceP: p(429) }],
      toppings: ["Double Mozzarella", "Basil", "Olive Oil"],
      isVeg: true, isFeatured: true, isBestseller: true, spiceLevel: "mild",
    },
    {
      name: "Cheese and Corn",
      description: "Sweet corn kernels and melted mozzarella on a tangy tomato base.",
      category: by["Classic Pizzas"],
      sizes: [{ label: "Small", priceP: p(219) }, { label: "Medium", priceP: p(319) }, { label: "Large", priceP: p(419) }],
      toppings: ["Mozzarella", "Sweet Corn"],
      isVeg: true, isNewArrival: true, spiceLevel: "mild",
    },

    // ── Vegetarian Pizzas ─────────────────────────────────────────────────────
    {
      name: "Farmhouse",
      description: "Capsicum, mushrooms, onions and tomatoes on a herbed tomato base.",
      category: by["Vegetarian Pizzas"],
      sizes: [{ label: "Small", priceP: p(219) }, { label: "Medium", priceP: p(319) }, { label: "Large", priceP: p(419) }],
      toppings: ["Capsicum", "Mushrooms", "Onions", "Tomatoes"],
      isVeg: true, isFeatured: true, spiceLevel: "mild",
    },
    {
      name: "Veggie Supreme",
      description: "A rainbow of bell peppers, olives, mushrooms, corn and onions.",
      category: by["Vegetarian Pizzas"],
      sizes: [{ label: "Small", priceP: p(229) }, { label: "Medium", priceP: p(329) }, { label: "Large", priceP: p(429) }],
      toppings: ["Red Bell Pepper", "Yellow Bell Pepper", "Mushrooms", "Black Olives", "Corn", "Onions"],
      isVeg: true, isBestseller: true, spiceLevel: "mild",
    },
    {
      name: "Mushroom Delight",
      description: "Three-mushroom blend — button, shiitake and portobello — with parmesan.",
      category: by["Vegetarian Pizzas"],
      sizes: [{ label: "Small", priceP: p(229) }, { label: "Medium", priceP: p(329) }, { label: "Large", priceP: p(429) }],
      toppings: ["Button Mushrooms", "Shiitake", "Portobello", "Parmesan"],
      isVeg: true, spiceLevel: "mild",
    },
    {
      name: "Mediterranean Veg",
      description: "Pesto base, feta, spinach, cherry tomatoes, black olives and artichoke.",
      category: by["Vegetarian Pizzas"],
      sizes: [{ label: "Small", priceP: p(249) }, { label: "Medium", priceP: p(349) }, { label: "Large", priceP: p(449) }],
      toppings: ["Feta", "Spinach", "Cherry Tomatoes", "Black Olives", "Artichoke"],
      isVeg: true, isNewArrival: true, spiceLevel: "mild",
    },
    {
      name: "Garden Fresh",
      description: "Bell peppers, mushrooms, olives, onions and tomatoes — garden on a crust.",
      category: by["Vegetarian Pizzas"],
      sizes: [{ label: "Small", priceP: p(219) }, { label: "Medium", priceP: p(319) }, { label: "Large", priceP: p(419) }],
      toppings: ["Bell Peppers", "Mushrooms", "Olives", "Onions", "Tomatoes"],
      isVeg: true, isFeatured: true, spiceLevel: "mild",
    },

    // ── Indian Fusion Pizzas ──────────────────────────────────────────────────
    {
      name: "Paneer Tikka",
      description: "Tandoori-marinated paneer, capsicum, onion on a mint chutney base.",
      category: by["Indian Fusion Pizzas"],
      sizes: [{ label: "Small", priceP: p(239) }, { label: "Medium", priceP: p(339) }, { label: "Large", priceP: p(439) }],
      toppings: ["Paneer", "Capsicum", "Onion", "Mint Chutney"],
      isVeg: true, isFeatured: true, isBestseller: true, spiceLevel: "medium",
    },
    {
      name: "Tandoori Paneer",
      description: "Smoky tandoori paneer cubes, red onion, capsicum and coriander chutney.",
      category: by["Indian Fusion Pizzas"],
      sizes: [{ label: "Small", priceP: p(249) }, { label: "Medium", priceP: p(349) }, { label: "Large", priceP: p(449) }],
      toppings: ["Tandoori Paneer", "Red Onion", "Capsicum", "Coriander Chutney"],
      isVeg: true, isNewArrival: true, spiceLevel: "medium",
    },
    {
      name: "Achari Veg",
      description: "Tangy pickle-spiced sauce, mixed vegetables and a hint of mustard.",
      category: by["Indian Fusion Pizzas"],
      sizes: [{ label: "Small", priceP: p(239) }, { label: "Medium", priceP: p(339) }, { label: "Large", priceP: p(439) }],
      toppings: ["Achari Sauce", "Capsicum", "Onion", "Tomato", "Mustard Seeds"],
      isVeg: true, spiceLevel: "medium",
    },
    {
      name: "Spicy Masala Paneer",
      description: "Paneer in a fiery masala sauce with green chillies and coriander.",
      category: by["Indian Fusion Pizzas"],
      sizes: [{ label: "Small", priceP: p(249) }, { label: "Medium", priceP: p(349) }, { label: "Large", priceP: p(449) }],
      toppings: ["Paneer", "Masala Sauce", "Green Chillies", "Coriander"],
      isVeg: true, spiceLevel: "hot",
    },

    // ── Spicy Pizzas ──────────────────────────────────────────────────────────
    {
      name: "Peri Peri Veg",
      description: "Fiery peri peri sauce, capsicum, onion, corn and jalapeños.",
      category: by["Spicy Pizzas"],
      sizes: [{ label: "Small", priceP: p(229) }, { label: "Medium", priceP: p(329) }, { label: "Large", priceP: p(429) }],
      toppings: ["Peri Peri Sauce", "Capsicum", "Onion", "Corn", "Jalapeños"],
      isVeg: true, isBestseller: true, spiceLevel: "hot",
    },
    {
      name: "Spicy Mexican",
      description: "Salsa base, jalapeños, red kidney beans, corn and cheddar.",
      category: by["Spicy Pizzas"],
      sizes: [{ label: "Small", priceP: p(239) }, { label: "Medium", priceP: p(339) }, { label: "Large", priceP: p(439) }],
      toppings: ["Salsa", "Jalapeños", "Red Kidney Beans", "Corn", "Cheddar"],
      isVeg: true, isNewArrival: true, spiceLevel: "hot",
    },
    {
      name: "Schezwan Veg",
      description: "Bold Schezwan sauce, capsicum, mushrooms, spring onion and chilli flakes.",
      category: by["Spicy Pizzas"],
      sizes: [{ label: "Small", priceP: p(229) }, { label: "Medium", priceP: p(329) }, { label: "Large", priceP: p(429) }],
      toppings: ["Schezwan Sauce", "Capsicum", "Mushrooms", "Spring Onion", "Chilli Flakes"],
      isVeg: true, spiceLevel: "extra-hot",
    },

    // ── Non-Vegetarian Pizzas ─────────────────────────────────────────────────
    {
      name: "Chicken Tikka",
      description: "Tandoori chicken tikka, capsicum, onion on a mint chutney base.",
      category: by["Non-Vegetarian Pizzas"],
      sizes: [{ label: "Small", priceP: p(259) }, { label: "Medium", priceP: p(359) }, { label: "Large", priceP: p(459) }],
      toppings: ["Chicken Tikka", "Capsicum", "Onion", "Mint Chutney"],
      isVeg: false, isFeatured: true, isBestseller: true, spiceLevel: "medium",
    },
    {
      name: "BBQ Chicken",
      description: "Smoky BBQ sauce, grilled chicken, red onions and mozzarella.",
      category: by["Non-Vegetarian Pizzas"],
      sizes: [{ label: "Small", priceP: p(269) }, { label: "Medium", priceP: p(369) }, { label: "Large", priceP: p(469) }],
      toppings: ["Grilled Chicken", "BBQ Sauce", "Red Onion", "Mozzarella"],
      isVeg: false, isFeatured: true, isBestseller: true, spiceLevel: "mild",
    },
    {
      name: "Pepperoni",
      description: "Classic American pepperoni loaded on a rich tomato base with mozzarella.",
      category: by["Non-Vegetarian Pizzas"],
      sizes: [{ label: "Small", priceP: p(249) }, { label: "Medium", priceP: p(349) }, { label: "Large", priceP: p(449) }],
      toppings: ["Pepperoni", "Mozzarella", "Tomato Sauce"],
      isVeg: false, isFeatured: true, isBestseller: true, spiceLevel: "mild",
    },
    {
      name: "Chicken Supreme",
      description: "Grilled chicken, jalapeños, corn and mozzarella — a crowd favourite.",
      category: by["Non-Vegetarian Pizzas"],
      sizes: [{ label: "Small", priceP: p(259) }, { label: "Medium", priceP: p(359) }, { label: "Large", priceP: p(459) }],
      toppings: ["Grilled Chicken", "Jalapeños", "Corn", "Mozzarella"],
      isVeg: false, isBestseller: true, spiceLevel: "medium",
    },
    {
      name: "Spicy Chicken",
      description: "Fiery peri peri chicken, green chillies, capsicum and cheddar.",
      category: by["Non-Vegetarian Pizzas"],
      sizes: [{ label: "Small", priceP: p(269) }, { label: "Medium", priceP: p(369) }, { label: "Large", priceP: p(469) }],
      toppings: ["Peri Peri Chicken", "Green Chillies", "Capsicum", "Cheddar"],
      isVeg: false, isNewArrival: true, spiceLevel: "hot",
    },

    // ── Premium Pizzas ────────────────────────────────────────────────────────
    {
      name: "Four Cheese",
      description: "Mozzarella, cheddar, parmesan and gouda — a cheese lover's dream.",
      category: by["Premium Pizzas"],
      sizes: [{ label: "Small", priceP: p(299) }, { label: "Medium", priceP: p(449) }, { label: "Large", priceP: p(599) }],
      toppings: ["Mozzarella", "Cheddar", "Parmesan", "Gouda"],
      isVeg: true, isFeatured: true, isBestseller: true, spiceLevel: "mild",
    },
    {
      name: "Truffle Mushroom",
      description: "Black truffle paste, wild mushrooms, arugula and aged parmesan.",
      category: by["Premium Pizzas"],
      sizes: [{ label: "Small", priceP: p(349) }, { label: "Medium", priceP: p(499) }, { label: "Large", priceP: p(649) }],
      toppings: ["Black Truffle", "Wild Mushrooms", "Arugula", "Parmesan"],
      isVeg: true, isFeatured: true, spiceLevel: "mild",
    },
    {
      name: "Premium Veggie",
      description: "Sun-dried tomatoes, artichoke hearts, caramelised onions, feta and pesto.",
      category: by["Premium Pizzas"],
      sizes: [{ label: "Small", priceP: p(319) }, { label: "Medium", priceP: p(469) }, { label: "Large", priceP: p(619) }],
      toppings: ["Sun-dried Tomatoes", "Artichoke Hearts", "Caramelised Onions", "Feta", "Pesto"],
      isVeg: true, isNewArrival: true, spiceLevel: "mild",
    },

    // ── International Pizzas ──────────────────────────────────────────────────
    {
      name: "Hawaiian",
      description: "Ham, pineapple chunks and mozzarella on a classic tomato base.",
      category: by["International Pizzas"],
      sizes: [{ label: "Small", priceP: p(249) }, { label: "Medium", priceP: p(349) }, { label: "Large", priceP: p(449) }],
      toppings: ["Ham", "Pineapple", "Mozzarella"],
      isVeg: false, isBestseller: true, spiceLevel: "mild",
    },
    {
      name: "Italian Garden",
      description: "Pesto base, sun-dried tomatoes, fresh basil, parmesan and pine nuts.",
      category: by["International Pizzas"],
      sizes: [{ label: "Small", priceP: p(259) }, { label: "Medium", priceP: p(359) }, { label: "Large", priceP: p(459) }],
      toppings: ["Pesto", "Sun-dried Tomatoes", "Basil", "Parmesan", "Pine Nuts"],
      isVeg: true, isNewArrival: true, spiceLevel: "mild",
    },
    {
      name: "Mexican Fiesta",
      description: "Salsa base, jalapeños, corn, black beans, cheddar and sour cream drizzle.",
      category: by["International Pizzas"],
      sizes: [{ label: "Small", priceP: p(249) }, { label: "Medium", priceP: p(349) }, { label: "Large", priceP: p(449) }],
      toppings: ["Salsa", "Jalapeños", "Corn", "Black Beans", "Cheddar"],
      isVeg: true, isNewArrival: true, spiceLevel: "hot",
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
