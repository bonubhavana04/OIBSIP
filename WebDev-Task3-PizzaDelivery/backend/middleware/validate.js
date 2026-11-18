/**
 * validate.js — lightweight request validation middleware.
 * Usage: router.post("/", validate(rules), handler)
 *
 * rules: object where keys are field paths (supports dot notation for nested)
 * and values are arrays of checker functions that return an error string or null.
 */

// ── Checker factories ─────────────────────────────────────────────────────────

const required = (label) => (v) =>
  v === undefined || v === null || v === "" ? `${label} is required` : null;

const isString = (label) => (v) =>
  v !== undefined && typeof v !== "string" ? `${label} must be a string` : null;

const minLen = (label, n) => (v) =>
  v && v.length < n ? `${label} must be at least ${n} characters` : null;

const maxLen = (label, n) => (v) =>
  v && v.length > n ? `${label} must be at most ${n} characters` : null;

const isEmail = (label) => (v) =>
  v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? `${label} must be a valid email` : null;

const isIn = (label, values) => (v) =>
  v !== undefined && !values.includes(v) ? `${label} must be one of: ${values.join(", ")}` : null;

const isInt = (label, min, max) => (v) => {
  if (v === undefined) return null;
  const n = Number(v);
  if (!Number.isInteger(n)) return `${label} must be an integer`;
  if (min !== undefined && n < min) return `${label} must be ≥ ${min}`;
  if (max !== undefined && n > max) return `${label} must be ≤ ${max}`;
  return null;
};

const isArray = (label, minItems = 0) => (v) => {
  if (v === undefined) return null;
  if (!Array.isArray(v)) return `${label} must be an array`;
  if (v.length < minItems) return `${label} must have at least ${minItems} item(s)`;
  return null;
};

const isMongoId = (label) => (v) =>
  v && !/^[a-f\d]{24}$/i.test(v) ? `${label} must be a valid ID` : null;

// ── Middleware factory ────────────────────────────────────────────────────────

/**
 * @param {Object} rules  e.g. { "email": [required("Email"), isEmail("Email")] }
 */
const validate = (rules) => (req, res, next) => {
  const errors = [];

  for (const [path, checkers] of Object.entries(rules)) {
    // Support dot-notation: "deliveryAddress.street"
    const value = path.split(".").reduce((obj, key) => obj?.[key], req.body);

    for (const checker of checkers) {
      const err = checker(value);
      if (err) { errors.push(err); break; }  // first error per field
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({ message: errors[0], errors });
  }
  next();
};

module.exports = {
  validate,
  // Export checkers so controllers can compose their own rules
  required, isString, minLen, maxLen, isEmail, isIn, isInt, isArray, isMongoId,
};
