const { MongoMemoryServer } = require("mongodb-memory-server");
const fs = require("fs");
const path = require("path");

module.exports = async () => {
  const mongod = await MongoMemoryServer.create();
  const uri    = mongod.getUri();

  // Store instance so globalTeardown can stop it
  global.__MONGOD__ = mongod;

  // Write URI to a temp file so the test file can read it
  fs.writeFileSync(path.join(__dirname, ".mongo-uri"), uri);

  process.env.MONGO_TEST_URI = uri;
};
