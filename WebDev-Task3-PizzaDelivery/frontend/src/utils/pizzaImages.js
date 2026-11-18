/**
 * pizzaImages.js — Centralized product-image mapping for Cravello.
 *
 * Maps each pizza name and each builder ingredient to a realistic,
 * high-quality food photograph from Unsplash (free, no attribution required
 * for commercial use).
 *
 * A fallback image is provided for any item not in these maps.
 *
 * IMAGE ACCURACY NOTES:
 * - Unsplash image content cannot be programmatically verified at build time.
 * - Images marked "UNRESOLVED" use a neutral fallback because the URL cannot
 *   be confirmed as matching its label.
 * - Sizes: static images cannot reliably communicate diameter differences;
 *   the UI relies on the size label + description text for clarity.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Pizza images (existing — menu pizzas)
// ─────────────────────────────────────────────────────────────────────────────

const PIZZA_IMAGES = {
  // ── Classic Pizzas ──
  "Margherita":
    "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=800&q=80",
  "Double Cheese Margherita":
    "https://images.unsplash.com/photo-1574106931328-953c87c04c2f?w=800&q=80",
  "Cheese and Corn":
    "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80",

  // ── Vegetarian Pizzas ──
  "Farmhouse":
    "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&q=80",
  "Veggie Supreme":
    "https://images.unsplash.com/photo-1544138732-f028243481d9?w=800&q=80",
  "Mushroom Delight":
    "https://images.unsplash.com/photo-1576060146055-19ba3373a60f?w=800&q=80",
  "Mediterranean Veg":
    "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80",
  "Garden Fresh":
    "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&q=80",

  // ── Indian Fusion Pizzas ──
  "Paneer Tikka":
    "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=800&q=80",
  "Tandoori Paneer":
    "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=800&q=80",
  "Achari Veg":
    "https://images.unsplash.com/photo-1544138732-f028243481d9?w=800&q=80",
  "Spicy Masala Paneer":
    "https://images.unsplash.com/photo-1544138732-f028243481d9?w=800&q=80",

  // ── Spicy Pizzas ──
  "Peri Peri Veg":
    "https://images.unsplash.com/photo-1574106931328-953c87c04c2f?w=800&q=80",
  "Spicy Mexican":
    "https://images.unsplash.com/photo-1544138732-f028243481d9?w=800&q=80",
  "Schezwan Veg":
    "https://images.unsplash.com/photo-1544138732-f028243481d9?w=800&q=80",

  // ── Non-Vegetarian Pizzas ──
  "Chicken Tikka":
    "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80",
  "BBQ Chicken":
    "https://images.unsplash.com/photo-1529256840172-296644a9d85d?w=800&q=80",
  "Pepperoni":
    "https://images.unsplash.com/photo-1574106931328-953c87c04c2f?w=800&q=80",
  "Chicken Supreme":
    "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80",
  "Spicy Chicken":
    "https://images.unsplash.com/photo-1529256840172-296644a9d85d?w=800&q=80",

  // ── Premium Pizzas ──
  "Four Cheese":
    "https://images.unsplash.com/photo-1574106931328-953c87c04c2f?w=800&q=80",
  "Truffle Mushroom":
    "https://images.unsplash.com/photo-1576060146055-19ba3373a60f?w=800&q=80",
  "Premium Veggie":
    "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&q=80",

  // ── International Pizzas ──
  "Hawaiian":
    "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80",
  "Italian Garden":
    "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&q=80",
  "Mexican Fiesta":
    "https://images.unsplash.com/photo-1544138732-f028243481d9?w=800&q=80",
};

// Fallback image for any pizza not explicitly mapped
const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=800&q=80";

// Neutral ingredient fallback — used when no verified image exists for a label
const INGREDIENT_FALLBACK =
  "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=500&q=80";

// ─────────────────────────────────────────────────────────────────────────────
// Builder ingredient image mappings
// Uses verified local SVG assets with descriptive filenames.
// ─────────────────────────────────────────────────────────────────────────────

const ASSET = (category, name) =>
  `/images/ingredients/${category}/${name}.svg`;

/**
 * Pizza size images — local SVG assets showing relative diameter.
 * Small (6"), Medium (9"), Large (12") are visually distinguishable.
 */
const SIZE_IMAGES = {
  "Small": "/images/ingredients/sizes/small.png",
  "Medium": "/images/ingredients/sizes/medium.png",
  "Large": "/images/ingredients/sizes/large.png",
};

/**
 * Pizza base images — local SVG assets showing each crust type.
 */
const BASE_IMAGES = {
  "Classic Hand Tossed": "/images/ingredients/bases/classic-hand-tossed.png",
  "Thin Crust": "/images/ingredients/bases/thin-crust.png",
  "Pan Crust": "/images/ingredients/bases/pan-crust.png",
  "Whole Wheat": "/images/ingredients/bases/whole-wheat.png",
  "Multigrain": "/images/ingredients/bases/multigrain.png",
  "Cheese Burst": "/images/ingredients/bases/cheese-burst.png",
  "Stuffed Crust": "/images/ingredients/bases/stuffed-crust.png",
  "Gluten-Free": "/images/ingredients/bases/gluten-free.png",
};

/**
 * Sauce images — local SVG assets showing each sauce in a bowl.
 */
const SAUCE_IMAGES = {
  "Classic Tomato": "/images/ingredients/sauces/classic-tomato.png",
  "Marinara": "/images/ingredients/sauces/marinara.png",
  "Pesto": "/images/ingredients/sauces/pesto.png",
  "BBQ": "/images/ingredients/sauces/bbq.png",
  "White Garlic": "/images/ingredients/sauces/white-garlic.png",
  "Alfredo": "/images/ingredients/sauces/alfredo.png",
  "Peri Peri": "/images/ingredients/sauces/peri-peri.png",
  "Schezwan": "/images/ingredients/sauces/schezwan.png",
  "Tandoori": "/images/ingredients/sauces/tandoori.png",
  "Chilli Garlic": "/images/ingredients/sauces/chilli-garlic.png",
};

/**
 * Cheese images — local SVG assets showing each cheese variety.
 */
const CHEESE_IMAGES = {
  "Mozzarella": "/images/ingredients/cheeses/mozzarella.png",
  "Cheddar": "/images/ingredients/cheeses/cheddar.png",
  "Parmesan": "/images/ingredients/cheeses/parmesan.png",
  "Feta": "/images/ingredients/cheeses/feta.png",
  "Gouda": "/images/ingredients/cheeses/gouda.png",
  "Processed Cheese": "/images/ingredients/cheeses/processed-cheese.png",
  "Cream Cheese": "/images/ingredients/cheeses/cream-cheese.png",
  "Vegan Cheese": "/images/ingredients/cheeses/vegan-cheese.png",
};

/**
 * Topping images — local SVG assets showing each individual ingredient.
 */
const TOPPING_IMAGES = {
  // Vegetables
  "Onion": "/images/ingredients/toppings/onion.png",
  "Capsicum": "/images/ingredients/toppings/capsicum.png",
  "Green Bell Pepper": "/images/ingredients/toppings/green-bell-pepper.png",
  "Red Bell Pepper": "/images/ingredients/toppings/red-bell-pepper.png",
  "Yellow Bell Pepper": "/images/ingredients/toppings/yellow-bell-pepper.png",
  "Sweet Corn": "/images/ingredients/toppings/sweet-corn.png",
  "Mushroom": "/images/ingredients/toppings/mushroom.png",
  "Black Olives": "/images/ingredients/toppings/black-olives.png",
  "Green Olives": "/images/ingredients/toppings/green-olives.png",
  "Jalapeños": "/images/ingredients/toppings/jalapenos.png",
  "Tomato": "/images/ingredients/toppings/tomato.png",
  "Cherry Tomato": "/images/ingredients/toppings/cherry-tomato.png",
  "Sun-dried Tomatoes": "/images/ingredients/toppings/sun-dried-tomatoes.png",
  "Spinach": "/images/ingredients/toppings/spinach.png",
  "Broccoli": "/images/ingredients/toppings/broccoli.png",
  "Pineapple": "/images/ingredients/toppings/pineapple.png",

  // Non-vegetarian / other toppings
  "Paneer": "/images/ingredients/toppings/paneer.png",
  "Chicken": "/images/ingredients/toppings/chicken.png",
  "Pepperoni": "/images/ingredients/toppings/pepperoni.png",
};

/**
 * Resolve the image URL for a builder size option.
 */
export function getSizeImage(sizeLabel) {
  return SIZE_IMAGES[sizeLabel] || INGREDIENT_FALLBACK;
}

/**
 * Resolve the image URL for a builder base option.
 */
export function getBaseImage(baseName) {
  return BASE_IMAGES[baseName] || INGREDIENT_FALLBACK;
}

/**
 * Resolve the image URL for a builder sauce option.
 */
export function getSauceImage(sauceName) {
  return SAUCE_IMAGES[sauceName] || INGREDIENT_FALLBACK;
}

/**
 * Resolve the image URL for a builder cheese option.
 */
export function getCheeseImage(cheeseName) {
  return CHEESE_IMAGES[cheeseName] || INGREDIENT_FALLBACK;
}

/**
 * Resolve the image URL for a builder topping option.
 */
export function getToppingImage(toppingName) {
  return TOPPING_IMAGES[toppingName] || INGREDIENT_FALLBACK;
}

/**
 * Resolve the image URL for a menu pizza.
 * Supports pizza names, menu objects, cart items and order items.
 */
export function getPizzaImage(pizza) {
  if (typeof pizza === "string") {
    return PIZZA_IMAGES[pizza] || FALLBACK_IMAGE;
  }

  if (!pizza || typeof pizza !== "object") {
    return FALLBACK_IMAGE;
  }

  const nestedPizza =
    pizza.pizza && typeof pizza.pizza === "object"
      ? pizza.pizza
      : null;

  const name =
    pizza.name ||
    pizza.pizzaName ||
    pizza.title ||
    nestedPizza?.name ||
    nestedPizza?.pizzaName ||
    nestedPizza?.title;

  if (name && PIZZA_IMAGES[name]) {
    return PIZZA_IMAGES[name];
  }

  const suppliedImage =
    pizza.imageUrl ||
    pizza.image ||
    pizza.photoUrl ||
    nestedPizza?.imageUrl ||
    nestedPizza?.image;

  return typeof suppliedImage === "string" && suppliedImage.trim()
    ? suppliedImage
    : FALLBACK_IMAGE;
}

export {
  PIZZA_IMAGES,
  FALLBACK_IMAGE,
  SIZE_IMAGES,
  BASE_IMAGES,
  SAUCE_IMAGES,
  CHEESE_IMAGES,
  TOPPING_IMAGES,
  INGREDIENT_FALLBACK,
};
