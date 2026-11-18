
require("dotenv").config();

const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const { EJSON } = require("bson");

async function backupDatabase() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const database = mongoose.connection.db;
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupDir = path.join(__dirname, "backups", `pizza_delivery_${timestamp}`);

    fs.mkdirSync(backupDir, { recursive: true });

    const collections = await database.listCollections().toArray();
    const manifest = [];

    for (const collection of collections) {
      const documents = await database
        .collection(collection.name)
        .find({})
        .toArray();

      const filePath = path.join(backupDir, `${collection.name}.json`);

      fs.writeFileSync(
        filePath,
        EJSON.stringify(documents, null, 2, { relaxed: false }),
        "utf8"
      );

      manifest.push({
        collection: collection.name,
        documentCount: documents.length,
        file: `${collection.name}.json`,
      });

      console.log(`${collection.name}: ${documents.length} documents backed up`);
    }

    fs.writeFileSync(
      path.join(backupDir, "manifest.json"),
      JSON.stringify({
        database: mongoose.connection.name,
        createdAt: new Date().toISOString(),
        collections: manifest,
      }, null, 2),
      "utf8"
    );

    console.log("\nBACKUP COMPLETED");
    console.log("Location:", backupDir);
  } catch (error) {
    console.error("BACKUP FAILED:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

backupDatabase();
