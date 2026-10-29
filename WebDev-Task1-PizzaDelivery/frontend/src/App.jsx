import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import Navbar from "./components/Navbar";
import ProtectedRoute, { PublicOnlyRoute } from "./components/ProtectedRoute";
import Home from "./pages/Home";
import Menu from "./pages/Menu";
import PizzaBuilder from "./pages/PizzaBuilder";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import Orders from "./pages/Orders";
import OrderTracking from "./pages/OrderTracking";
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import VerifyEmail from "./pages/VerifyEmail";
import AdminDashboard from "./pages/admin/Dashboard";
import ManageOrders from "./pages/admin/ManageOrders";
import AdminInventory from "./pages/admin/Inventory";
import NotFound from "./pages/NotFound";

// Pages that own their full layout (no shared Navbar / main wrapper)
const STANDALONE_PREFIXES = ["/login", "/register", "/forgot-password", "/reset-password", "/verify-email", "/admin"];

function Layout() {
  const { pathname } = useLocation();
  const isStandalone = STANDALONE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  return (
    <>
      {!isStandalone && <Navbar />}
      {isStandalone ? (
        <Routes>
          <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
          <Route path="/register" element={<PublicOnlyRoute><Register /></PublicOnlyRoute>} />
          <Route path="/forgot-password" element={<PublicOnlyRoute><ForgotPassword /></PublicOnlyRoute>} />
          <Route path="/reset-password"  element={<PublicOnlyRoute><ResetPassword /></PublicOnlyRoute>} />
          <Route path="/verify-email"    element={<VerifyEmail />} />
          <Route path="/admin" element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/orders" element={<ProtectedRoute adminOnly><ManageOrders /></ProtectedRoute>} />
          <Route path="/admin/inventory" element={<ProtectedRoute adminOnly><AdminInventory /></ProtectedRoute>} />
        </Routes>
      ) : (
        <main className="main-content">
          <Routes>
            <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
            <Route path="/menu" element={<ProtectedRoute><Menu /></ProtectedRoute>} />
            <Route path="/builder" element={<ProtectedRoute><PizzaBuilder /></ProtectedRoute>} />
            <Route path="/cart" element={<ProtectedRoute><Cart /></ProtectedRoute>} />
            <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
            <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
            <Route path="/orders/:id" element={<ProtectedRoute><OrderTracking /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
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
