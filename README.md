
# OIBSIP – Oasis Infobyte Internship Tasks

## 🍕 Cravello — Full-Stack Pizza Delivery App

A complete MERN-stack pizza delivery application developed as part of the Oasis Infobyte internship tasks.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, React Router v7, Axios, Socket.IO Client |
| Backend | Node.js, Express 5, MongoDB, Mongoose 9 |
| Auth | JWT (jsonwebtoken), bcryptjs |
| Payments | Razorpay (test mode) |
| Email | Nodemailer (Gmail SMTP) |
| Real-time | Socket.IO |
| Scheduled jobs | node-cron |

## Project Structure

```
WebDev-Task3-PizzaDelivery/
├── backend/
│   ├── config/         # MongoDB connection
│   ├── controllers/    # Route handler logic
│   ├── middleware/     # JWT auth, admin guard
│   ├── models/         # Mongoose schemas (User, Pizza, Category, Order)
│   ├── routes/         # Express routers
│   ├── utils/          # Mailer, cron jobs
│   ├── seedAdmin.js    # One-time admin account seeder
│   ├── seedMenu.js     # Pizza catalogue seeder
│   └── server.js       # Entry point
└── frontend/
    └── src/
        ├── api/        # Axios instance with JWT interceptor
        ├── components/ # Navbar, PizzaCard, ProtectedRoute
        ├── context/    # AuthContext, CartContext
        └── pages/      # All customer and admin pages
```

## Prerequisites

- Node.js 18+
- MongoDB running locally **or** a MongoDB Atlas connection string
- A [Razorpay](https://dashboard.razorpay.com) test account (for payments)
- A Gmail account with an [App Password](https://myaccount.google.com/apppasswords) (for emails)

## Setup

### 1. Clone and install dependencies

```bash
git clone <repo-url>
cd WebDev-Task1-PizzaDelivery

# Install all dependencies (backend + frontend) in one command
npm run install:all
```

Or install separately:

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Configure environment variables

```bash
cd backend
cp .env.example .env
```

Open `backend/.env` and fill in your real values:

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/pizza_delivery
JWT_SECRET=<generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">
JWT_EXPIRES_IN=7d
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=<your razorpay secret>
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=<your gmail app password>
CLIENT_URL=http://localhost:5173
```

### 3. Seed the database

```bash
cd backend
npm run seed:admin   # Creates admin@pizza.com / admin123
npm run seed:menu    # Creates 4 categories and 12 pizzas
```

### 4. Run the application

**Option A — Both servers with one command (from root):**

```bash
npm run dev
```

**Option B — Separately:**

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

Frontend: http://localhost:5173  
Backend API: http://localhost:5000

## Default Accounts

| Role | Email | Password |
|---|---|---|
| Admin | admin@pizza.com | admin123 |
| Customer | Register via /register | — |

> **Change the admin password after first login in production.**

> ⚠️ **OPEN ADMIN REGISTRATION — NO INVITE CODE, NO RESTRICTION**
> Admin self-registration (`POST /api/auth/admin/register` / `/admin-register`) is **completely open**.
> Any visitor who reaches that page can create a full administrator account with no approval, no invite code, and no secret.
> This is intentional for development and demo purposes.
> **Do not deploy this to production without restricting the endpoint** (e.g. add an `ADMIN_REGISTRATION_OPEN` env flag, put the route behind a VPN, or remove it entirely and provision admins via `npm run seed:admin`).

## API Endpoints

### Auth
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Create **customer** account (requires email verification) |
| POST | `/api/auth/login` | Public | Customer login, returns JWT |
| GET | `/api/auth/me` | JWT | Get current user |
| PUT | `/api/auth/profile` | JWT | Update profile |
| POST | `/api/auth/admin/register` | **Public ⚠️** | Create **admin** account — open, no invite code |
| POST | `/api/auth/admin/login` | Public | Admin login — rejects non-admin accounts |

### Menu
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/pizzas` | JWT | List pizzas (filterable) |
| GET | `/api/pizzas/:id` | JWT | Get single pizza |
| POST | `/api/pizzas` | Admin | Create pizza |
| PUT | `/api/pizzas/:id` | Admin | Update pizza |
| DELETE | `/api/pizzas/:id` | Admin | Delete pizza |
| GET | `/api/pizzas/categories` | JWT | List categories |
| POST | `/api/pizzas/categories` | Admin | Create category |

### Orders
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/orders` | JWT | Place order |
| GET | `/api/orders` | JWT | List orders (own / all for admin) |
| GET | `/api/orders/:id` | JWT | Get order detail |
| PUT | `/api/orders/:id/status` | Admin | Update order status |
| PUT | `/api/orders/:id/cancel` | JWT | Cancel order |
| GET | `/api/orders/admin/stats` | Admin | Revenue + status counts |

### Payments
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/payments/create-order` | JWT | Create Razorpay order |
| POST | `/api/payments/verify` | JWT | Verify payment signature |
| POST | `/api/payments/cod-confirm` | JWT | Confirm COD order |
| GET | `/api/payments/status/:orderId` | JWT | Get payment status |

## Query Parameters — `GET /api/pizzas`

```
?category=<categoryId>
?isVeg=true|false
?isFeatured=true
?search=<text>
?sort=newest|price_asc|price_desc|rating
```

## Authentication Flow

1. User registers → redirected to Login (no auto-login)
2. User logs in → JWT stored in `localStorage`
3. Every API request sends `Authorization: Bearer <token>`
4. On app load, token is validated against `GET /api/auth/me` — expired tokens are cleared
5. All customer routes require a valid JWT; admin routes additionally require `role: "admin"`
6. On logout, localStorage is cleared and user is redirected to `/login`

## Real-time Order Tracking

After placing an order, the frontend joins a Socket.IO room (`order_<id>`).  
When an admin updates the order status, the server emits `order_status_update` to that room and the tracking page updates instantly.

## Notes

- Razorpay is in **test mode** — use [test card numbers](https://razorpay.com/docs/payments/payments/test-card-details/)
- Email sending is **non-blocking** — if SMTP is not configured, orders still work
- Unpaid Razorpay orders are **auto-cancelled after 15 minutes** by the cron job

## Low-Stock Email Alerts

The server runs a scheduled inventory check (default: every 5 minutes) and emails the configured admin address when any ingredient's `stock` falls at or below its `lowStockThreshold`.

### How it works

- Only items with finite tracked stock (`stock >= 0`) are checked; `stock: -1` (unlimited) is ignored.
- A `LowStockAlert` document is inserted atomically in MongoDB when an alert fires. Subsequent cron runs find the document already exists and skip — no duplicate emails.
- When an admin restocks an item above its threshold (via `/restock` or `/adjust`), the document is deleted. The next time stock dips low, a fresh alert is sent.
- If SMTP fails, the alert document is rolled back so the next cron run retries.
- Multiple server instances are safe: MongoDB's unique index ensures only one instance wins the insert and sends the email.

### Configuration

Add to `backend/.env`:

```env
# Recipient for low-stock emails (falls back to EMAIL_USER if not set)
ALERT_ADMIN_EMAIL=ops@yourdomain.com

# node-cron schedule — default is every 5 minutes
# "*/1 * * * *" = every minute (useful in dev)
# "0 * * * *"   = hourly (production)
LOW_STOCK_CRON=*/5 * * * *
```

### Gmail SMTP setup

1. Enable **2-Step Verification** on your Google account.
2. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords).
3. Generate an App Password for **Mail**. Copy the 16-character code.
4. Set in `backend/.env`:

```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=you@gmail.com
EMAIL_PASS=abcdefghijklmnop   # 16-char app password, spaces optional
```

> Do **not** use your real Gmail password — it will not work and is a security risk.

### Other SMTP providers

| Provider | EMAIL_HOST | EMAIL_PORT |
|---|---|---|
| SendGrid | `smtp.sendgrid.net` | `587` |
| Brevo (Sendinblue) | `smtp-relay.brevo.com` | `587` |
| Mailgun | `smtp.mailgun.org` | `587` |
| Outlook / Office 365 | `smtp.office365.com` | `587` |

All use STARTTLS on port 587. Set `EMAIL_USER` and `EMAIL_PASS` to the credentials provided by the service.

### Testing

**CLI — send a test alert immediately (bypasses dedup, uses real SMTP):**

```bash
cd backend
npm run test:low-stock
```

Expected output when SMTP is working:
```
SMTP accepted: [ 'ops@yourdomain.com' ]
```

**HTTP endpoint — trigger against real inventory data (admin JWT required):**

```bash
curl -X POST http://localhost:5000/api/inventory/admin/test-low-stock-alert \
  -H "Authorization: Bearer <admin_jwt>"
```

Response when items are low and SMTP is configured:
```json
{ "sent": true, "smtpAccepted": 1, "items": [{"name": "Wheat Base", "stock": 3, "threshold": 10}] }
```

Response when SMTP is not configured:
```json
{ "sent": false, "message": "SMTP not configured — email skipped", "items": [...] }
```

### Test plan

| Scenario | Steps | Expected |
|---|---|---|
| Low-stock alert fires | Set `stock <= lowStockThreshold` via `/adjust`, wait for cron or call test endpoint | Email received; `LowStockAlert` doc exists in DB |
| Duplicate suppressed | Call test endpoint twice without restocking | Second call: cron finds existing doc, skips; no second email |
| Re-alert after replenishment | Restock above threshold (`/restock`), then deplete again | `LowStockAlert` doc deleted on restock; fresh email on next dip |
| SMTP failure | Set wrong `EMAIL_PASS`, trigger check | `502` response; `LowStockAlert` doc rolled back; next run retries |
| SMTP not configured | Leave `EMAIL_USER` blank | `sent: false` logged/returned; server does not crash |

## Admin Registration & Auth — Test Plan

| Scenario | Steps | Expected |
|---|---|---|
| Open registration | Visit `/admin-register`, fill name/email/password/confirm | Account created, JWT returned, redirected to `/admin` dashboard |
| Duplicate email | Register twice with the same email | `409 Email already registered` |
| Short password | Submit password < 8 chars | `400 Password must be at least 8 characters` |
| Mismatched passwords | Submit different password and confirm | `400 Passwords do not match` |
| Missing fields | Submit with any field blank | `400 All fields are required` |
| Password hashing | Check DB after registration | `password` field is a bcrypt hash, never plaintext |
| Role assignment | Inspect JWT payload or `GET /api/auth/me` | `role: "admin"` — never accepted from frontend input |
| Admin login | Visit `/admin-login`, sign in with registered admin | JWT stored, redirected to `/admin` |
| Customer/admin separation | Register via `/register` (customer flow) | `role: "user"`, cannot access `/admin` routes |
| Customer cannot self-promote | POST `/api/auth/register` with `role: "admin"` in body | Role ignored; account created as `"user"` |
| Logout | Click Logout button in admin dashboard header | `localStorage` cleared, redirected to `/admin-login` |
| Protected route after logout | Navigate to `/admin` after logout | Redirected to `/admin-login` |
| Mobile logout | On ≤900 px viewport, click Logout in mobile bar | Same as desktop — session cleared, redirect fires |

