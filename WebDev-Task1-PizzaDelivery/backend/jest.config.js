/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  testTimeout:     120000,
  setupFiles:      ["./tests/jestSetup.js"],
};
