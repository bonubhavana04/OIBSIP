const mongoose = require("mongoose");

/**
 * PizzaIngredient — defines how much of each inventory ingredient
 * a single unit of a menu pizza consumes.
 *
 * Custom (builder) pizzas derive their ingredients directly from the
 * customPizza sub-document on the order item, so they don't need this.
 *
 * qty: units consumed per pizza ordered (default 1).
 *      e.g. a pizza that uses 2 units of mozzarella has qty: 2.
 */
const pizzaIngredientSchema = new mongoose.Schema(
  {
    pizza: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Pizza",
      required: true,
      index:    true,
    },
    ingredient: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Inventory",
      required: true,
    },
    qty: { type: Number, required: true, min: 1, default: 1 },
  },
  { timestamps: true }
);

pizzaIngredientSchema.index({ pizza: 1, ingredient: 1 }, { unique: true });

module.exports = mongoose.model("PizzaIngredient", pizzaIngredientSchema);
