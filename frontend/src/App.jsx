import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import Navbar from "./components/Navbar";
import ProtectedRoute, { PublicOnlyRoute } from "./components/ProtectedRoute";
import Home from "./pages/Home";
import Welcome from "./pages/Welcome";
import Menu from "./pages/Menu";
import PizzaBuilder from "./pages/PizzaBuilder";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import Orders from "./pages/Orders";
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import VerifyEmail from "./pages/VerifyEmail";
import AdminLogin from "./pages/AdminLogin";
import AdminRegister from "./pages/AdminRegister";
import NotFound from "./pages/NotFound";

// Pages that own their full layout (no shared Navbar / main wrapper)
const STANDALONE_PREFIXES = ["/", "/login", "/register", "/forgot-password", "/reset-password", "/verify-email", "/admin", "/admin-login", "/admin-register"];

const LazyAdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const LazyManageOrders = lazy(() => import("./pages/admin/ManageOrders"));
const LazyAdminOrderDetail = lazy(() => import("./pages/admin/AdminOrderDetail"));
const LazyAdminInventory = lazy(() => import("./pages/admin/Inventory"));
const LazyAdminPizzas = lazy(() => import("./pages/admin/AdminPizzas"));
const LazyAdminStorefront = lazy(() => import("./pages/admin/Storefront"));
const LazyOrderTracking = lazy(() => import("./pages/OrderTracking"));

function Layout() {
  const { pathname } = useLocation();
  const isStandalone = STANDALONE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  return (
    <>
      {!isStandalone && <Navbar />}
      {isStandalone ? (
        <Suspense fallback={<div className="loading">Loading...</div>}>
          <Routes>
            <Route path="/" element={<Welcome />} />
            <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
            <Route path="/register" element={<PublicOnlyRoute><Register /></PublicOnlyRoute>} />
            <Route path="/forgot-password" element={<PublicOnlyRoute><ForgotPassword /></PublicOnlyRoute>} />
            <Route path="/reset-password"  element={<PublicOnlyRoute><ResetPassword /></PublicOnlyRoute>} />
            <Route path="/verify-email"    element={<VerifyEmail />} />
            <Route path="/admin-login"     element={<AdminLogin />} />
            <Route path="/admin/login"     element={<AdminLogin />} />
            <Route path="/admin-register"  element={<AdminRegister />} />
            <Route path="/admin" element={<ProtectedRoute adminOnly><LazyAdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/dashboard" element={<ProtectedRoute adminOnly><LazyAdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/orders" element={<ProtectedRoute adminOnly><LazyManageOrders /></ProtectedRoute>} />
            <Route path="/admin/orders/:id" element={<ProtectedRoute adminOnly><LazyAdminOrderDetail /></ProtectedRoute>} />
            <Route path="/admin/inventory" element={<ProtectedRoute adminOnly><LazyAdminInventory /></ProtectedRoute>} />
            <Route path="/admin/pizzas" element={<ProtectedRoute adminOnly><LazyAdminPizzas /></ProtectedRoute>} />
            <Route path="/admin/storefront" element={<ProtectedRoute adminOnly><LazyAdminStorefront /></ProtectedRoute>} />
          </Routes>
        </Suspense>
      ) : (
        <main className="main-content">
          <Suspense fallback={<div className="loading">Loading...</div>}>
            <Routes>
              <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
              <Route path="/menu" element={<ProtectedRoute><Menu /></ProtectedRoute>} />
              <Route path="/builder" element={<ProtectedRoute><PizzaBuilder /></ProtectedRoute>} />
              <Route path="/cart" element={<ProtectedRoute><Cart /></ProtectedRoute>} />
              <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
              <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
              <Route path="/orders/:id" element={<ProtectedRoute><LazyOrderTracking /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </main>
      )}
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              style: { background: "#1e1e1e", color: "#fff", borderRadius: "10px", fontSize: "0.88rem" },
              success: { iconTheme: { primary: "#c0392b", secondary: "#fff" } },
            }}
          />
          <Layout />
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}