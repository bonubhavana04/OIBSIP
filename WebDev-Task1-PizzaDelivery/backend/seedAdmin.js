/**
 * seedAdmin.js — creates the first admin account.
 *
 * Usage:
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=YourStr0ngPass! node seedAdmin.js
 *
 * Or set ADMIN_EMAIL and ADMIN_PASSWORD in your .env file, then:
 *   npm run seed:admin
 *
 * The script is idempotent — running it again when an admin already exists
 * prints a message and exits without making changes.
 *
 * NEVER hardcode a password here.  The password is hashed by the User model
 * pre-save hook before it is stored.
 */
require("dotenv").config();
const mongoose = require("mongoose");
const User     = require("./models/User");

const seed = async () => {
  const email    = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name     = process.env.ADMIN_NAME || "Admin";

  if (!email || !password) {
    console.error(
      "\n❌  ADMIN_EMAIL and ADMIN_PASSWORD must be set.\n" +
      "    Example:\n" +
      "      ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=YourStr0ngPass! node seedAdmin.js\n" +
      "    Or add them to backend/.env and run: npm run seed:admin\n"
    );
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("❌  ADMIN_PASSWORD must be at least 8 characters.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);

  const existing = await User.findOne({ role: "admin" });
  if (existing) {
    console.log(`ℹ️   Admin already exists: ${existing.email}`);
    console.log("    To change the password, log in and use the profile page.");
    process.exit(0);
  }

  await User.create({
    name,
    email:           email.toLowerCase().trim(),
    password,
    role:            "admin",
    isEmailVerified: true,   // admin accounts are pre-verified
  });

  console.log(`✅  Admin account created: ${email}`);
  console.log("    Store the password securely — it cannot be recovered from the database.");
  process.exit(0);
};

seed().catch((err) => {
  console.error("Seed error:", err.message);
  process.exit(1);
});
