const router      = require("express").Router();
const rateLimit   = require("express-rate-limit");
const {
  register, login, getMe, updateProfile, changePassword,
  verifyEmail, resendVerification,
  forgotPassword, resetPassword,
} = require("../controllers/authController");
const { protect } = require("../middleware/auth");
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

module.exports = router;
