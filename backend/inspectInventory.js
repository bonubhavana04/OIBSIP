require("dotenv").config();

const mongoose = require("mongoose");
const Order = require("./models/Order");
const Inventory = require("./models/Inventory");
const { buildIngredientMap } = require("./utils/inventoryService");

async function inspectInventory() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("\n========== EXISTING ORDERS ==========\n");

    const orders = await Order.find({})
      .select("_id status payment stockReserved stockDeducted items createdAt")
      .sort({ createdAt: 1 })
      .lean();

    for (const order of orders) {
      const ingredientCounts = await buildIngredientMap(order.items);

      console.log({
        orderId: order._id.toString(),
        status: order.status,
        paymentMethod: order.payment?.method,
        paymentStatus: order.payment?.status,
        stockReserved: order.stockReserved,
        stockDeducted: order.stockDeducted,
        itemCount: order.items?.length || 0,
        requiredIngredients: Object.fromEntries(ingredientCounts),
      });
    }

    console.log("\n========== CURRENT INVENTORY ==========\n");

    const inventory = await Inventory.find({})
      .select("_id name stock reservedStock")
      .sort({ name: 1 })
      .lean();

    for (const item of inventory) {
      console.log({
        id: item._id.toString(),
        name: item.name,
        stock: item.stock,
        reservedStock: item.reservedStock,
        availableStock:
          item.stock === -1 ? "Unlimited" : item.stock - item.reservedStock,
      });
    }

    console.log("\n========== INSPECTION COMPLETED ==========");
  } catch (error) {
    console.error("INSPECTION FAILED:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

inspectInventory();