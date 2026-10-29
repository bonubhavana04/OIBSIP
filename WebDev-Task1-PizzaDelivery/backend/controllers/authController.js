const crypto = require("crypto");
const jwt    = require("jsonwebtoken");
const User   = require("../models/User");
const {
  sendVerificationEmail,
  sendPasswordResetEmail,
} = require("../utils/mailer");

// ── Helpers ───────────────────────────────────────────────────────────────────

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

/** Safe user object — never includes password, tokens, or internal fields */
const userPayload = (user) => ({
  _id:             user._id,
  name:            user.name,
  email:           user.email,
  phone:           user.phone,
  role:            user.role,
  isEmailVerified: user.isEmailVerified,
  addresses:       user.addresses,
  createdAt:       user.createdAt,
});

const sendAuth = (res, user, statusCode = 200) =>
  res.status(statusCode).json({ token: signToken(user._id), user: userPayload(user) });

// ── POST /api/auth/register ───────────────────────────────────────────────────
const register = async (req, res) => {
  const { name, email, password, phone } = req.body;
  // email is lowercased by the schema — check after normalisation
  const normEmail = email.toLowerCase().trim();

  const exists = await User.findOne({ email: normEmail });
  if (exists) return res.status(409).json({ message: "Email already registered" });

  const user = await User.create({ name, email: normEmail, password, phone });

  // Generate and store a hashed verification token; send the raw token by email
  const rawToken = user.createEmailVerifyToken();
  await user.save({ validateBeforeSave: false });

  // Non-blocking — if email fails the account is still created; user can re-request
  sendVerificationEmail(user, rawToken).catch((err) =>
    console.error("Verification email error:", err.message)
  );

  res.status(201).json({
    message: "Account created. Please check your email to verify your address before logging in.",
  });
};

// ── POST /api/auth/login ──────────────────────────────────────────────────────
const login = async (req, res) => {
  const { email, password } = req.body;

  // Explicitly select password (select:false by default)
  const user = await User.findOne({ email: email.toLowerCase().trim() }).select("+password");

  // Use a single generic message to prevent user enumeration
  if (!user || !(await user.comparePassword(password)))
    return res.status(401).json({ message: "Invalid email or password" });

  // Block unverified accounts
  if (!user.isEmailVerified)
    return res.status(403).json({
      message: "Please verify your email address before logging in.",
      code:    "EMAIL_NOT_VERIFIED",
    });

  sendAuth(res, user);
};

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
const getMe = async (req, res) => {
  res.json({ user: userPayload(req.user) });
};

// ── PUT /api/auth/profile ─────────────────────────────────────────────────────
const updateProfile = async (req, res) => {
  const { name, phone, addresses } = req.body;
  const user = await User.findById(req.user._id);

  if (name)      user.name      = name;
  if (phone)     user.phone     = phone;
  if (addresses) user.addresses = addresses;

  await user.save();
  res.json({ user: userPayload(user) });
};

// ── PUT /api/auth/change-password ─────────────────────────────────────────────
const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword)
    return res.status(400).json({ message: "currentPassword and newPassword are required" });
  if (newPassword.length < 8)
    return res.status(400).json({ message: "New password must be at least 8 characters" });

  const user = await User.findById(req.user._id).select("+password");
  if (!(await user.comparePassword(currentPassword)))
    return res.status(401).json({ message: "Current password is incorrect" });

  user.password = newPassword;
  await user.save();
  // Return a fresh token so the client stays logged in
  sendAuth(res, user);
};

// ── GET /api/auth/verify-email?token=xxx ─────────────────────────────────────
const verifyEmail = async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ message: "Verification token required" });

  const hashed = crypto.createHash("sha256").update(token).digest("hex");
  const user   = await User.findOne({
    emailVerifyToken:   hashed,
    emailVerifyExpires: { $gt: Date.now() },
  }).select("+emailVerifyToken +emailVerifyExpires");

  if (!user) return res.status(400).json({ message: "Token is invalid or has expired" });

  // Mark verified and clear token fields (single-use)
  user.isEmailVerified    = true;
  user.emailVerifyToken   = undefined;
  user.emailVerifyExpires = undefined;
  await user.save({ validateBeforeSave: false });

  res.json({ message: "Email verified successfully. You can now log in." });
};

// ── POST /api/auth/resend-verification ───────────────────────────────────────
const resendVerification = async (req, res) => {
  const { email } = req.body;
  // Generic response to prevent enumeration
  const GENERIC = { message: "If that email is registered and unverified, a new link has been sent." };

  const user = await User.findOne({ email: email?.toLowerCase().trim() })
    .select("+emailVerifyToken +emailVerifyExpires");

  if (!user || user.isEmailVerified) return res.json(GENERIC);

  const rawToken = user.createEmailVerifyToken();
  await user.save({ validateBeforeSave: false });

  sendVerificationEmail(user, rawToken).catch((err) =>
    console.error("Resend verification error:", err.message)
  );

  res.json(GENERIC);
};

// ── POST /api/auth/forgot-password ───────────────────────────────────────────
const forgotPassword = async (req, res) => {
  const GENERIC = { message: "If that email is registered, a reset link has been sent." };
  const { email } = req.body;

  const user = await User.findOne({ email: email?.toLowerCase().trim() })
    .select("+passwordResetToken +passwordResetExpires");

  // Always return the same response — never reveal whether email exists
  if (!user) return res.json(GENERIC);

  const rawToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  try {
    await sendPasswordResetEmail(user, rawToken);
  } catch (err) {
    // Clear token so user can retry; log message only — never log the token
    user.passwordResetToken   = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });
    console.error("Password reset email error:", err.message);
    return res.status(500).json({ message: "Failed to send reset email. Please try again later." });
  }

  res.json(GENERIC);
};

// ── POST /api/auth/reset-password ────────────────────────────────────────────
const resetPassword = async (req, res) => {
  const { token, password } = req.body;

  const hashed = crypto.createHash("sha256").update(token).digest("hex");

  const user = await User.findOne({
    passwordResetToken:   hashed,
    passwordResetExpires: { $gt: Date.now() },
  }).select("+password +passwordResetToken +passwordResetExpires");

  if (!user) return res.status(400).json({ message: "Token is invalid or has expired" });

  // Update password and clear reset fields (single-use)
  user.password             = password;
  user.passwordResetToken   = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  // Log the user in immediately after reset
  sendAuth(res, user);
};

module.exports = {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
};
