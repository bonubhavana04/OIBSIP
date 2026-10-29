/**
 * mailer.js — all outbound email for Cravello.
 *
 * EMAIL_USER must be set in .env to enable sending.
 * If it is absent, every send is a silent no-op so the app still works
 * without SMTP configured (development / CI).
 *
 * NEVER log EMAIL_PASS or raw tokens here.
 */
const nodemailer = require("nodemailer");

// ── Transporter (lazy singleton) ──────────────────────────────────────────────
let _transporter = null;

const getTransporter = () => {
  if (_transporter) return _transporter;
  _transporter = nodemailer.createTransport({
    host:   process.env.EMAIL_HOST   || "smtp.gmail.com",
    port:   Number(process.env.EMAIL_PORT) || 587,
    secure: false,   // STARTTLS
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
  return _transporter;
};

// ── Guard — skip silently when SMTP is not configured ─────────────────────────
const canSend = () => Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);

// ── HTML shell ────────────────────────────────────────────────────────────────
const shell = (title, body) => `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#fdf8f3;font-family:sans-serif;color:#1e1e1e">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:32px 16px">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.08)">
        <tr><td style="background:#c0392b;padding:24px 32px">
          <span style="font-size:22px;font-weight:800;color:#fff;letter-spacing:-.5px">Cravello</span>
          <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#fff;margin-left:3px;vertical-align:middle"></span>
        </td></tr>
        <tr><td style="padding:32px">
          <h2 style="margin:0 0 16px;font-size:20px;color:#1e1e1e">${title}</h2>
          ${body}
          <p style="margin:32px 0 0;font-size:12px;color:#9ca3af">
            You received this email because you have an account with Cravello.<br/>
            If you didn't request this, you can safely ignore it.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const btn = (url, label) =>
  `<a href="${url}" style="display:inline-block;margin:20px 0;padding:12px 28px;background:#c0392b;color:#fff;border-radius:9999px;font-weight:600;font-size:15px;text-decoration:none">${label}</a>`;

// ── Send helper ───────────────────────────────────────────────────────────────
const send = async ({ to, subject, html }) => {
  if (!canSend()) return;   // silent no-op
  await getTransporter().sendMail({
    from:    `"Cravello" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  });
};

// ── Email verification ────────────────────────────────────────────────────────
const sendVerificationEmail = async (user, rawToken) => {
  const url = `${process.env.CLIENT_URL}/verify-email?token=${rawToken}`;
  await send({
    to:      user.email,
    subject: "Verify your Cravello email address",
    html: shell(
      "Verify your email",
      `<p>Hi ${user.name},</p>
       <p>Thanks for signing up! Click the button below to verify your email address. This link expires in <strong>24 hours</strong>.</p>
       ${btn(url, "Verify Email")}
       <p style="font-size:13px;color:#6b6b6b">Or copy this link:<br/><a href="${url}" style="color:#c0392b;word-break:break-all">${url}</a></p>`
    ),
  });
};

// ── Password reset ────────────────────────────────────────────────────────────
const sendPasswordResetEmail = async (user, rawToken) => {
  const url = `${process.env.CLIENT_URL}/reset-password?token=${rawToken}`;
  await send({
    to:      user.email,
    subject: "Reset your Cravello password",
    html: shell(
      "Reset your password",
      `<p>Hi ${user.name},</p>
       <p>We received a request to reset your password. Click the button below — this link expires in <strong>1 hour</strong>.</p>
       ${btn(url, "Reset Password")}
       <p style="font-size:13px;color:#6b6b6b">Or copy this link:<br/><a href="${url}" style="color:#c0392b;word-break:break-all">${url}</a></p>
       <p style="font-size:13px;color:#6b6b6b">If you didn't request a password reset, ignore this email — your password won't change.</p>`
    ),
  });
};

// ── Order confirmation ────────────────────────────────────────────────────────
const itemsHtml = (items) =>
  items.map((i) =>
    `<tr>
      <td style="padding:6px 8px;border-bottom:1px solid #f5ede0">${i.name} (${i.size})</td>
      <td style="padding:6px 8px;text-align:center;border-bottom:1px solid #f5ede0">${i.quantity}</td>
      <td style="padding:6px 8px;text-align:right;border-bottom:1px solid #f5ede0">₹${i.price * i.quantity}</td>
    </tr>`
  ).join("");

const sendOrderConfirmation = async (order) => {
  if (!order?.user?.email) return;
  await send({
    to:      order.user.email,
    subject: `Order confirmed — #${order._id.toString().slice(-8).toUpperCase()}`,
    html: shell(
      "Your order is confirmed! 🎉",
      `<p>Hi ${order.user.name}, we've received your order and it's being prepared.</p>
       <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border-collapse:collapse">
         <thead>
           <tr style="background:#fdf8f3">
             <th style="padding:8px;text-align:left;font-size:13px">Item</th>
             <th style="padding:8px;text-align:center;font-size:13px">Qty</th>
             <th style="padding:8px;text-align:right;font-size:13px">Price</th>
           </tr>
         </thead>
         <tbody>${itemsHtml(order.items)}</tbody>
         <tfoot>
           <tr><td colspan="2" style="padding:8px;text-align:right;font-size:13px">Delivery Fee</td><td style="padding:8px;text-align:right;font-size:13px">₹${order.deliveryFee}</td></tr>
           <tr><td colspan="2" style="padding:8px;text-align:right;font-weight:700">Total</td><td style="padding:8px;text-align:right;font-weight:700">₹${order.total}</td></tr>
         </tfoot>
       </table>
       <p>Estimated delivery: <strong>${new Date(order.estimatedDelivery).toLocaleTimeString()}</strong></p>`
    ),
  });
};

// ── Order status update ───────────────────────────────────────────────────────
const STATUS_LABELS = {
  pending:          "Order Received",
  confirmed:        "Order Confirmed",
  preparing:        "Being Prepared",
  out_for_delivery: "Out for Delivery",
  delivered:        "Delivered",
  cancelled:        "Cancelled",
};

const sendStatusUpdate = async (order) => {
  if (!order?.user?.email) return;
  const label = STATUS_LABELS[order.status] || order.status;
  await send({
    to:      order.user.email,
    subject: `Order update: ${label} — #${order._id.toString().slice(-8).toUpperCase()}`,
    html: shell(
      `Order ${label}`,
      `<p>Hi ${order.user.name}, your order status has been updated.</p>
       <p style="font-size:22px;font-weight:800;color:#c0392b;margin:16px 0">${label}</p>
       <p>Order total: <strong>₹${order.total}</strong></p>`
    ),
  });
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendOrderConfirmation,
  sendStatusUpdate,
};
