/**
 * tests/mongoTestEnvironment.js
 *
 * Custom Jest environment that fixes the mongodb driver 7.x "Missing required
 * sub-document 'driver'" error on Node.js 22+ inside Jest's VM context.
 *
 * Root cause: Jest's NodeEnvironment creates a VM context where process.versions
 * is a Proxy that doesn't satisfy the mongodb driver's validation of the
 * client metadata 'driver' sub-document.
 *
 * Fix: copy the real process.versions into the VM context before tests run.
 */
const { TestEnvironment } = require("jest-environment-node");

class MongoTestEnvironment extends TestEnvironment {
  async setup() {
    await super.setup();
    // process.versions properties are read-only — replace the entire object
    // with a writable copy so the mongodb driver can read node version info
    // correctly inside Jest's VM context on Node.js 22+.
    Object.defineProperty(this.global.process, "versions", {
      value:        { ...process.versions },
      writable:     true,
      configurable: true,
    });
    Object.assign(this.global.process.env, process.env);
  }
}

module.exports = MongoTestEnvironment;
