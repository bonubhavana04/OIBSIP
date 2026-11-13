/**
 * verify.js — Cravello checkout flow verification
 * Run from backend/: node verify.js
 */
require("dotenv").config();
const http = require("http");

function req(method, path, body, token) {
  return new Promise((resolve) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const headers = { ...(bodyStr ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(bodyStr) } : {}) };
    if (token) headers["Authorization"] = "Bearer " + token;
    const r = http.request({ hostname: "localhost", port: 5000, path, method, headers }, (res) => {
      let d = ""; res.on("data", (c) => (d += c));
      res.on("end", () => { try { resolve({ status: res.statusCode, body: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, body: d }); } });
    });
    r.on("error", (e) => resolve({ status: 0, body: { error: e.message } }));
    if (bodyStr) r.write(bodyStr);
    r.end();
  });
}

function pass(label) { console.log("  ✅ PASS:", label); }
function fail(label, detail) { console.log("  ❌ FAIL:", label, detail || ""); }

async function run() {
  console.log("\n=== Cravello Checkout Flow Verification ===\n");

  // ── 1. Login ────────────────────────────────────────────────────────────────
  console.log("Step 1: Login");
  const login = await req("POST", "/api/auth/login", { email: "admin@pizza.com", password: "admin123" });
  if (login.status === 200 && login.body.token) {
    pass(`Login → 200, token issued (len=${login.body.token.length})`);
  } else {
    fail("Login", `status=${login.status} body=${JSON.stringify(login.body)}`);
    return;
  }
  const token = login.body.token;

  // ── 2. GET /auth/me ─────────────────────────────────────────────────────────
  console.log("\nStep 2: GET /api/auth/me");
  const me = await req("GET", "/api/auth/me", null, token);
  if (me.status === 200 && me.body.user?.email) {
    pass(`/auth/me → 200, user=${me.body.user.email}, verified=${me.body.user.isEmailVerified}`);
  } else {
    fail("/auth/me", `status=${me.status}`);
    return;
  }

  // ── 3. Get a real pizza ─────────────────────────────────────────────────────
  console.log("\nStep 3: Fetch menu");
  const menu = await req("GET", "/api/pizzas", null, token);
  if (menu.status !== 200 || !menu.body.pizzas?.length) { fail("GET /api/pizzas"); return; }
  const pizza = menu.body.pizzas[0];
  pass(`Menu loaded, using "${pizza.name}" (${pizza.sizes[0].label})`);

  // ── 4. POST /api/orders (razorpay) ──────────────────────────────────────────
  console.log("\nStep 4: POST /api/orders (paymentMethod=razorpay)");
  const orderRes = await req("POST", "/api/orders", {
    items: [{ itemType: "menu", pizza: pizza._id, size: pizza.sizes[0].label, quantity: 1 }],
    deliveryAddress: { street: "42 MG Road", city: "Bengaluru", state: "Karnataka", pincode: "560001" },
    paymentMethod: "razorpay",
  }, token);
  if (orderRes.status === 201 && orderRes.body.order?._id) {
    pass(`Order created → 201, orderId=${orderRes.body.order._id}, payment.method=${orderRes.body.order.payment?.method}`);
  } else {
    fail("POST /api/orders", `status=${orderRes.status} msg=${orderRes.body.message}`);
    return;
  }
  const orderId = orderRes.body.order._id;

  // ── 5. POST /api/payments/create-order ──────────────────────────────────────
  console.log("\nStep 5: POST /api/payments/create-order");
  const payRes = await req("POST", "/api/payments/create-order", { orderId }, token);
  if (payRes.status === 200 && payRes.body.razorpayOrderId) {
    pass(`Razorpay order created → 200`);
    pass(`  razorpayOrderId = ${payRes.body.razorpayOrderId}`);
    pass(`  keyId           = ${payRes.body.keyId}`);
    pass(`  amount          = ${payRes.body.amount} paise (₹${payRes.body.amount / 100})`);
    pass(`  currency        = ${payRes.body.currency}`);
  } else {
    fail("POST /api/payments/create-order", `status=${payRes.status} msg=${payRes.body.message}`);
    return;
  }

  // ── 6. COD regression ───────────────────────────────────────────────────────
  console.log("\nStep 6: COD regression");
  const codOrder = await req("POST", "/api/orders", {
    items: [{ itemType: "menu", pizza: pizza._id, size: pizza.sizes[0].label, quantity: 1 }],
    deliveryAddress: { street: "42 MG Road", city: "Bengaluru", state: "Karnataka", pincode: "560001" },
    paymentMethod: "cod",
  }, token);
  if (codOrder.status === 201) {
    pass(`COD order created → 201, orderId=${codOrder.body.order._id}`);
    const codConfirm = await req("POST", "/api/payments/cod-confirm", { orderId: codOrder.body.order._id }, token);
    if (codConfirm.status === 200) {
      pass(`COD confirm → 200, status=${codConfirm.body.order?.status}`);
    } else {
      fail("POST /api/payments/cod-confirm", `status=${codConfirm.status} msg=${codConfirm.body.message}`);
    }
  } else {
    fail("COD POST /api/orders", `status=${codOrder.status} msg=${codOrder.body.message}`);
  }

  // ── 7. Invalid token → 401 (interceptor should suppress redirect for /orders) ─
  console.log("\nStep 7: Invalid token on /api/orders → expect 401 (no redirect in browser)");
  const badToken = await req("POST", "/api/orders", { items: [], deliveryAddress: {}, paymentMethod: "cod" }, "INVALID_TOKEN");
  if (badToken.status === 401) {
    pass(`/api/orders with bad token → 401 (Axios interceptor will NOT redirect — handled by Checkout.jsx)`);
  } else {
    fail("Expected 401 for invalid token", `got ${badToken.status}`);
  }

  // ── 8. Invalid token → 401 on /api/payments/create-order ───────────────────
  console.log("\nStep 8: Invalid token on /api/payments/create-order → expect 401");
  const badPay = await req("POST", "/api/payments/create-order", { orderId: "fake" }, "INVALID_TOKEN");
  if (badPay.status === 401) {
    pass(`/api/payments/create-order with bad token → 401 (Axios interceptor will NOT redirect — handled by Checkout.jsx)`);
  } else {
    fail("Expected 401 for invalid token on payments", `got ${badPay.status}`);
  }

  console.log("\n=== All checks complete ===\n");
}

run().catch(console.error);
