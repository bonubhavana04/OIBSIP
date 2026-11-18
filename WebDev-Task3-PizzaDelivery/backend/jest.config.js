/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "./tests/mongoTestEnvironment.js",
  testTimeout:     120000,
  setupFiles:      ["./tests/jestSetup.js"],
  // globalSetup / globalTeardown are intentionally omitted:
  // each test file manages its own MongoMemoryServer instance for isolation.
  // The jestSetup.js file pins the MongoDB version so the binary is shared
  // across all test workers after the first download.
};
