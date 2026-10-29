const jwt  = require("jsonwebtoken");
const User = require("../models/User");

/**
 * protect — verifies Bearer JWT, attaches req.user (no password field).
 * Returns 401 on missing/invalid/expired token.
 */
const protect = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer "))
    return res.status(401).json({ message: "Not authorized — no token" });

  const token = header.split(" ")[1];

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: "Token invalid or expired" });
  }

  // password has select:false — it will NOT be included here
  const user = await User.findById(decoded.id);
  if (!user) return res.status(401).json({ message: "User no longer exists" });

  req.user = user;
  next();
};

/**
 * adminOnly — must come after protect.
 * Enforces role on the backend; frontend routing is a UX convenience only.
 */
const adminOnly = (req, res, next) => {
  if (req.user?.role !== "admin")
    return res.status(403).json({ message: "Admin access required" });
  next();
};

/**
 * requireVerified — blocks unverified users from placing orders etc.
 * Must come after protect.
 */
const requireVerified = (req, res, next) => {
  if (!req.user?.isEmailVerified)
    return res.status(403).json({
      message: "Please verify your email address to access this feature.",
      code:    "EMAIL_NOT_VERIFIED",
    });
  next();
};

module.exports = { protect, adminOnly, requireVerified };
