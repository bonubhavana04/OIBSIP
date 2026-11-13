const router      = require("express").Router();
const rateLimit   = require("express-rate-limit");
const {
  register, login, adminLogin, registerAdmin, createAdminAccount,
  getMe, updateProfile, changePassword,
  verifyEmail, resendVerification,
  forgotPassword, resetPassword,
} = require("../controllers/authController");
const { protect, adminOnly } = require("../middleware/auth");
const {
  validate, required, isEmail, minLen, maxLen, isString,
} = require("../middleware/validate");

// ── Rate limiters ─────────────────────────────────────────────────────────────

/** Strict limiter for login — 10 attempts per 15 minutes per IP */
const loginLimiter = rateLimit({
  windowMs:         15 * 60 * 1000,
  max:              10,
  standardHeaders:  true,
  legacyHeaders:    false,
  message:          { message: "Too many login attempts. Please try again in 15 minutes." },
  skipSuccessfulRequests: true,   // only count failures
});

/** Moderate limiter for register / forgot-password — 5 per hour per IP */
const authLimiter = rateLimit({
  windowMs:        60 * 60 * 1000,
  max:             5,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { message: "Too many requests. Please try again later." },
});

// ── Validation rule sets ──────────────────────────────────────────────────────

const registerRules = validate({
  name:     [required("Name"),     isString("Name"),     minLen("Name", 2),     maxLen("Name", 60)],
  email:    [required("Email"),    isEmail("Email")],
  password: [required("Password"), minLen("Password", 8), maxLen("Password", 72)],
});

const loginRules = validate({
  email:    [required("Email"),    isEmail("Email")],
  password: [required("Password")],
});

const emailOnlyRules = validate({
  email: [required("Email"), isEmail("Email")],
});

const resetRules = validate({
  token:    [required("Token")],
  password: [required("Password"), minLen("Password", 8), maxLen("Password", 72)],
});

// ── Public routes ─────────────────────────────────────────────────────────────

router.post("/register",             authLimiter,  registerRules,  register);
router.post("/login",                loginLimiter, loginRules,     login);
router.post("/forgot-password",      authLimiter,  emailOnlyRules, forgotPassword);
router.post("/reset-password",       authLimiter,  resetRules,     resetPassword);
router.post("/resend-verification",  authLimiter,  emailOnlyRules, resendVerification);
router.get( "/verify-email",                                        verifyEmail);

// ── Protected routes ──────────────────────────────────────────────────────────

router.get("/me",              protect, getMe);
router.put("/profile",         protect, updateProfile);
router.put("/change-password", protect, changePassword);

// ── Admin-only routes ─────────────────────────────────────────────────────────

// Dedicated admin login — server-side rejects non-admins and inactive accounts
router.post("/admin/login", loginLimiter, loginRules, adminLogin);

// Open admin self-registration — no invite code required
// ⚠️  Any visitor can create an admin account. Restrict in production if needed.
router.post("/admin/register", authLimiter, validate({
  name:            [required("Name"),            isString("Name"),     minLen("Name", 2),     maxLen("Name", 60)],
  email:           [required("Email"),           isEmail("Email")],
  password:        [required("Password"),        minLen("Password", 8), maxLen("Password", 72)],
  confirmPassword: [required("Confirm password")],
}), registerAdmin);

// Create additional admin accounts — existing admin JWT required
router.post("/admin/accounts", protect, adminOnly, validate({
  name:     [required("Name"),     isString("Name"),     minLen("Name", 2),     maxLen("Name", 60)],
  email:    [required("Email"),    isEmail("Email")],
  password: [required("Password"), minLen("Password", 8), maxLen("Password", 72)],
}), createAdminAccount);

// List all admin accounts — existing admin JWT required
router.get("/admin/accounts", protect, adminOnly, async (req, res) => {
  const User = require("../models/User");
  const admins = await User.find({ role: "admin" }).select("name email isActive createdAt").lean();
  res.json({ admins });
});

// Toggle admin active/inactive — existing admin JWT required, cannot deactivate self
router.patch("/admin/accounts/:id/status", protect, adminOnly, async (req, res) => {
  const User = require("../models/User");
  const { isActive } = req.body;
  if (typeof isActive !== "boolean")
    return res.status(400).json({ message: "isActive (boolean) is required" });
  if (req.params.id === req.user._id.toString())
    return res.status(400).json({ message: "You cannot deactivate your own account" });
  const admin = await User.findOneAndUpdate(
    { _id: req.params.id, role: "admin" },
    { isActive },
    { new: true }
  ).select("name email isActive");
  if (!admin) return res.status(404).json({ message: "Admin account not found" });
  res.json({ admin });
});

module.exports = router;
