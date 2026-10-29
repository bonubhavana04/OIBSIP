# 🍕 PizzaHub — Full-Stack Pizza Delivery App

A complete MERN-stack pizza delivery application built as an internship project.

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
WebDev-Task1-PizzaDelivery/
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

## API Endpoints

### Auth
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Create account |
| POST | `/api/auth/login` | Public | Login, returns JWT |
| GET | `/api/auth/me` | JWT | Get current user |
| PUT | `/api/auth/profile` | JWT | Update profile |

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
