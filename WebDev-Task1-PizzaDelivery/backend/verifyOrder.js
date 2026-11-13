
require("dotenv").config();
const mongoose = require("mongoose");

async function main() {
  await mongoose.connect(process.env.MONGO_URI);

  const db = mongoose.connection.db;
  const orderId = new mongoose.Types.ObjectId(
    "6ae372524daa5cae5fff0d0d"
  );

  const order = await db.collection("orders").findOne({
    _id: orderId
  });

  console.log("\n=== ORDER PAYMENT FIELDS ===");
  console.log(JSON.stringify(order, null, 2));

  const ingredientIds = [
    "6add284b2e3aff2a41cf09b3",
    "6add284b2e3aff2a41cf09b9",
    "6add284b2e3aff2a41cf09bd",
    "6add284b2e3aff2a41cf09c1",
    "6add284b2e3aff2a41cf09c2",
    "6add284b2e3aff2a41cf09c6"
  ].map(id => new mongoose.Types.ObjectId(id));

  console.log("\n=== SELECTED INVENTORY ITEMS ===");
  const ingredients = await db.collection("inventories")
    .find({ _id: { $in: ingredientIds } })
    .toArray();

  console.log(JSON.stringify(ingredients, null, 2));

  console.log("\n=== RECENT INVENTORY LOGS ===");
  const logs = await db.collection("inventorylogs")
    .find({})
    .sort({ createdAt: -1 })
    .limit(15)
    .toArray();

  console.log(JSON.stringify(logs, null, 2));
}

main()
  .catch(console.error)
  .finally(() => mongoose.disconnect());
