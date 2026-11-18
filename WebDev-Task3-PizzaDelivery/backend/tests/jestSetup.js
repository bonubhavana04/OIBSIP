// Runs before each test file, in the test worker process.
// Forces mongodb-memory-server to download/use MongoDB 6.x,
// which is compatible with Mongoose 9's bundled mongodb driver 6.x.
process.env.MONGOMS_VERSION = "6.0.14";
