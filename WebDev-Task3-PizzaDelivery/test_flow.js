require("dotenv").config({ path: "./backend/.env" });
const http = require("http");

function request(options, body) {
  return new Promise((resolve) => {
    const req = http.request(options, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => resolve({ status: res.statusCode, body: d }));
    });
    req.on("error", (e) => resolve({ status: 0, body: e.message }));
    if (body) req.write(body);
    req.end();
  });
}

async function run() {
  // 1. Login
  const loginBody = JSON.stringify({ email: "admin@pizza.com", password: "admin123" });
  const login = await request(
    { hostname: "localhost", port: 5000, path: "/api/auth/login", method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(loginBody) } },
    loginBody
  );
  console.log("1. POST /api/auth/login →", login.status);
  const token = JSON.parse(login.body).token;
  if (!token) { console.log("   No token:", login.body); return; }
  console.log("   Token length:", token.length);

  // 2. GET /api/auth/me
  const me = await request(
    { hostname: "localhost", port: 5000, path: "/api/auth/me", method: "GET",
      headers: { Authorization: "Bearer " + token } }
  );
  console.log("2. GET /api/auth/me →", me.status, me.body.substring(0, 80));

  // 3. POST /api/orders (will fail on pizza ID but we want the auth status)
  const orderBody = JSON.stringify({
    items: [{ itemType: "menu", pizza: "000000000000000000000001", size: "Medium", quantity: 1 }],
    deliveryAddress: { street: "42 MG Road", city: "Bengaluru", state: "Karnataka", pincode: "560001" },
    paymentMethod: "razorpay",
  });
  const order = await request(
    { hostname: "localhost", port: 5000, path: "/api/orders", method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(orderBody), Authorization: "Bearer " + token } },
    orderBody
  );
  console.log("3. POST /api/orders →", order.status, order.body.substring(0, 120));

  // 4. POST /api/payments/create-order (with fake orderId)
  const payBody = JSON.stringify({ orderId: "000000000000000000000001" });
  const pay = await request(
    { hostname: "localhost", port: 5000, path: "/api/payments/create-order", method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payBody), Authorization: "Bearer " + token } },
    payBody
  );
  console.log("4. POST /api/payments/create-order →", pay.status, pay.body.substring(0, 120));
}

run().catch(console.error);
