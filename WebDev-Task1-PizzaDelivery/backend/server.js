const express  = require("express");
const cors     = require("cors");
const http     = require("http");
const { Server } = require("socket.io");
require("dotenv").config();

const connectDB       = require("./config/db");
const { startCronJobs } = require("./utils/cronJobs");

const app    = express();
const server = http.createServer(app);

// ── Socket.IO ─────────────────────────────────────────────────────────────────
const jwt   = require("jsonwebtoken");
const User  = require("./models/User");
const Order = require("./models/Order");

const io = new Server(server, {
  cors: {
    origin:  process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

// Authenticate every socket connection via JWT in handshake auth
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("Authentication required"));
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("_id role");
    if (!user) return next(new Error("User not found"));
    socket.user = user;
    next();
  } catch {
    next(new Error("Invalid token"));
  }
});

app.use((req, _res, next) => { req.io = io; next(); });

// ── Core middleware ───────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim());

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, Postman, server-to-server)
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods:          ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders:   ["Content-Type", "Authorization"],
  credentials:      true,
  optionsSuccessStatus: 200,
}));
// ── Routes ────────────────────────────────────────────────────────────────────
const authRoutes       = require("./routes/authRoutes");
const pizzaRoutes      = require("./routes/pizzaRoutes");
const orderRoutes      = require("./routes/orderRoutes");
const paymentRoutes    = require("./routes/paymentRoutes");
const inventoryRoutes  = require("./routes/inventoryRoutes");
const storefrontRoutes = require("./routes/storefrontRoutes");

// Payment routes first: webhook needs the untouched raw request body.
app.use("/api/payments", paymentRoutes);
app.use("/api/v1/payments", paymentRoutes);

// Parse JSON request bodies for the remaining API routes.
app.use(express.json({ limit: "10kb" }));

// Storefront routes need a larger limit for base64 banner images (up to ~2.7 MB encoded)
const storefrontJsonParser = express.json({ limit: "4mb" });

// Versioned prefix — /api/v1/...
app.use("/api/v1/auth",      authRoutes);
app.use("/api/v1/pizzas",    pizzaRoutes);
app.use("/api/v1/orders",    orderRoutes);
app.use("/api/v1/inventory", inventoryRoutes);
app.use("/api/v1/storefront", storefrontJsonParser, storefrontRoutes);

// Backward-compatible alias — /api/... (keeps existing frontend working)
app.use("/api/auth",       authRoutes);
app.use("/api/pizzas",     pizzaRoutes);
app.use("/api/orders",     orderRoutes);
app.use("/api/inventory",  inventoryRoutes);
app.use("/api/storefront", storefrontJsonParser, storefrontRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) =>
  res.json({
    status:    "OK",
    timestamp: new Date().toISOString(),
    uptime:    Math.floor(process.uptime()),
    env:       process.env.NODE_ENV || "development",
  })
);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ message: "Route not found" }));

// ── Global error handler (Express 5 catches async throws automatically) ───────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err.message);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ message: err.message || "Internal server error" });
});

// ── Socket.IO events ──────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  // join_order: validate the requesting user owns the order (or is admin)
  socket.on("join_order", async (orderId) => {
    try {
      const order = await Order.findById(orderId).select("user").lean();
      if (!order) return;
      const isOwner = order.user.toString() === socket.user._id.toString();
      const isAdmin = socket.user.role === "admin";
      if (!isOwner && !isAdmin) return; // silently reject — don't leak existence
      socket.join(`order_${orderId}`);
    } catch {
      // ignore invalid ObjectIds
    }
  });

  socket.on("disconnect", () => {});
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT) || 5000;

connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`API v1:  http://localhost:${PORT}/api/v1`);
    console.log(`Health:  http://localhost:${PORT}/api/health`);
    startCronJobs(io);
  });

  // Graceful EADDRINUSE — log clearly instead of crashing with an unhandled event
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`\n❌  Port ${PORT} is already in use.\n   Stop the other process or set PORT= in .env\n`);
    } else {
      console.error("Server error:", err);
    }
    process.exit(1);
  });
});
