/**
 * resetAdminPassword.js — emergency password reset for an admin account.
 *
 * Usage (set vars in .env or pass inline):
 *   ADMIN_EMAIL=admin@example.com ADMIN_NEW_PASSWORD=NewStr0ng! node resetAdminPassword.js
 *
 * Or add ADMIN_EMAIL and ADMIN_NEW_PASSWORD to backend/.env, then:
 *   npm run reset:admin-password
 *
 * NEVER hardcode a password here. The password is hashed by the User model
 * pre-save hook before it is stored.
 */
require("dotenv").config();
const mongoose = require("mongoose");
const User     = require("./models/User");

const run = async () => {
  const email    = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_NEW_PASSWORD;

  if (!email || !password) {
    console.error(
      "\n❌  ADMIN_EMAIL and ADMIN_NEW_PASSWORD must be set.\n" +
      "    Example:\n" +
      "      ADMIN_EMAIL=admin@example.com ADMIN_NEW_PASSWORD=NewStr0ng! node resetAdminPassword.js\n"
    );
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("❌  ADMIN_NEW_PASSWORD must be at least 8 characters.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);

  const admin = await User.findOne({ email: email.toLowerCase().trim(), role: "admin" });
  if (!admin) {
    console.error(`❌  No admin account found for: ${email}`);
    process.exit(1);
  }

  admin.password = password;   // pre-save hook hashes it
  await admin.save();

  console.log(`✅  Password updated for admin: ${admin.email}`);
  console.log("    Store the new password securely.");
  process.exit(0);
};

run().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
