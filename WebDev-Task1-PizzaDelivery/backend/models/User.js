const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");
const crypto   = require("crypto");

const addressSchema = new mongoose.Schema(
  {
    label:   { type: String, trim: true },
    street:  { type: String, trim: true },
    city:    { type: String, trim: true },
    state:   { type: String, trim: true },
    pincode: { type: String, trim: true },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true, trim: true },
    email:    {
      type:      String,
      required:  true,
      unique:    true,
      lowercase: true,   // normalise on write
      trim:      true,
    },
    password: { type: String, required: true, minlength: 6, select: false },
    phone:    { type: String, trim: true },
    role:     { type: String, enum: ["user", "admin"], default: "user" },

    // Email verification (UI flow exists; backend token generation added here)
    isEmailVerified:      { type: Boolean, default: false },
    emailVerifyToken:     { type: String, select: false },
    emailVerifyExpires:   { type: Date,   select: false },

    // Password reset
    passwordResetToken:   { type: String, select: false },
    passwordResetExpires: { type: Date,   select: false },

    addresses: { type: [addressSchema], default: [] },
  },
  { timestamps: true }
);

// ── Indexes ──────────────────────────────────────────────────────────────────
// email is already indexed via unique:true on the field — no need to repeat it
userSchema.index({ role: 1 });

// ── Hooks ────────────────────────────────────────────────────────────────────
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

// ── Instance methods ─────────────────────────────────────────────────────────
userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

/** Generate a SHA-256 hex token, store its hash, return the raw token */
userSchema.methods.createPasswordResetToken = function () {
  const raw   = crypto.randomBytes(32).toString("hex");
  this.passwordResetToken   = crypto.createHash("sha256").update(raw).digest("hex");
  this.passwordResetExpires = Date.now() + 60 * 60 * 1000; // 1 hour
  return raw;
};

userSchema.methods.createEmailVerifyToken = function () {
  const raw = crypto.randomBytes(32).toString("hex");
  this.emailVerifyToken   = crypto.createHash("sha256").update(raw).digest("hex");
  this.emailVerifyExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  return raw;
};

module.exports = mongoose.model("User", userSchema);
