import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import toast from "react-hot-toast";
import { getPizzaImage } from "../utils/pizzaImages";

const DELIVERY_FEE = 40;

/** Dynamically load the Razorpay checkout script once */
const loadRazorpayScript = () =>
  new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload  = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });

export default function Checkout() {
  const { items, subtotal, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [address, setAddress]           = useState({ street: "", city: "", state: "", pincode: "" });
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [notes, setNotes]               = useState("");
  const [loading, setLoading]           = useState(false);
  const [razorpayAvailable, setRazorpayAvailable] = useState(false);
  const rzpRef = useRef(null);

  // Promo code state
  const [promoInput, setPromoInput]     = useState("");
  const [promoResult, setPromoResult]   = useState(null); // { discount, title, promoId, ... }
  const [promoError, setPromoError]     = useState("");
  const [promoLoading, setPromoLoading] = useState(false);

  // Check if Razorpay keys are configured on the server
  useEffect(() => {
    // We probe by attempting to load the script; actual key availability is
    // confirmed when we call /payments/create-order. If the server returns 503
    // we fall back gracefully.
    loadRazorpayScript().then(setRazorpayAvailable);
  }, []);

  // Cleanup: close any open Razorpay modal if the component unmounts mid-flow
  useEffect(() => () => { rzpRef.current?.close(); }, []);

  const setField = (k, v) => setAddress((a) => ({ ...a, [k]: v }));

  const applyPromo = async () => {
    if (!promoInput.trim()) return;
    setPromoLoading(true);
    setPromoError("");
    setPromoResult(null);
    try {
      const { data } = await api.post("/storefront/validate-promo", {
        promoCode: promoInput.trim(),
        orderTotal: subtotal + DELIVERY_FEE,
      });
      setPromoResult(data);
    } catch (err) {
      setPromoError(err.response?.data?.message || "Invalid promo code");
    } finally {
      setPromoLoading(false);
    }
  };

  const removePromo = () => { setPromoResult(null); setPromoInput(""); setPromoError(""); };

  const buildOrderItems = () =>
    items.map((i) => {
      if (i.itemType === "custom") {
        return {
          itemType:    "custom",
          size:        i.size,
          quantity:    i.quantity,
          customPizza: {
            base:    i.customPizza.base,
            sauce:   i.customPizza.sauce,
            cheese:  i.customPizza.cheese,
            veggies: i.customPizza.veggies || [],
          },
        };
      }
      return { itemType: "menu", pizza: i.pizza._id, size: i.size, quantity: i.quantity };
    });

  const validateAddress = () => {
    if (!address.street || !address.city || !address.state || !address.pincode) {
      toast.error("Please fill in the complete delivery address");
      return false;
    }
    return true;
  };

  // ── COD flow ────────────────────────────────────────────────────────────────
  const handleCOD = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/orders", {
        items: buildOrderItems(), deliveryAddress: address,
        paymentMethod: "cod", notes,
        promoCode: promoResult ? promoInput.trim() : undefined,
      });
      await api.post("/payments/cod-confirm", { orderId: data.order._id });
      clearCart();
      toast.success("Order placed! 🎉");
      navigate(`/orders/${data.order._id}`);
    } catch (err) {
      handleOrderError(err);
      setLoading(false);
    }
  };

  // ── Razorpay flow ───────────────────────────────────────────────────────────
  const handleRazorpay = async () => {
    setLoading(true);

    let order;
    try {
      // 1. Create the order on our backend (payment method = razorpay)
      const { data } = await api.post("/orders", {
        items: buildOrderItems(), deliveryAddress: address,
        paymentMethod: "razorpay", notes,
        promoCode: promoResult ? promoInput.trim() : undefined,
      });
      order = data.order;
    } catch (err) {
      handleOrderError(err);
      setLoading(false);
      return;
    }

    let rzpOrderData;
    try {
      // 2. Create a Razorpay order on the backend
      const { data } = await api.post("/payments/create-order", { orderId: order._id });
      rzpOrderData = data;
    } catch (err) {
      if (err.response?.status === 401) {
        toast.error("Your session has expired. Please log in again.");
        navigate("/login");
      } else {
        toast.error(err.response?.data?.message || "Could not initialise payment. Please try COD.");
      }
      setLoading(false);
      return;
    }

    // 3. Open the Razorpay checkout modal
    const options = {
      key:         rzpOrderData.keyId,
      amount:      rzpOrderData.amount,
      currency:    rzpOrderData.currency || "INR",
      name:        "Cravello",
      description: `Order #${order._id.slice(-8).toUpperCase()}`,
      order_id:    rzpOrderData.razorpayOrderId,
      prefill: {
        name:  user?.name  || "",
        email: user?.email || "",
      },
      theme: { color: "#c0392b" },

      handler: async (response) => {
        // 4. Verify the payment signature on our backend
        try {
          await api.post("/payments/verify", {
            razorpayOrderId:   response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
            orderId:           order._id,
          });
          clearCart();
          toast.success("Payment successful! 🎉");
          navigate(`/orders/${order._id}`);
        } catch (err) {
          toast.error(err.response?.data?.message || "Payment verification failed. Contact support.");
          setLoading(false);
        }
      },

    };

    // Track whether payment.failed already fired so ondismiss doesn't
    // show a second toast (Razorpay fires ondismiss after payment.failed).
    let paymentFailed = false;

    options.modal = {
      ondismiss: () => {
        // Skip the cancellation toast when failure already handled navigation.
        if (paymentFailed) return;
        toast("Payment cancelled. Your order is held for 15 minutes.", { icon: "ℹ️" });
        setLoading(false);
        navigate(`/orders/${order._id}`);
      },
    };

    const rzp = new window.Razorpay(options);
    rzpRef.current = rzp;

    rzp.on("payment.failed", (response) => {
      paymentFailed = true;
      toast.error(`Payment failed: ${response.error.description}`);
      setLoading(false);
      navigate(`/orders/${order._id}`);
    });

    rzp.open();
  };

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    if (!validateAddress()) return;
    if (paymentMethod === "razorpay") {
      await handleRazorpay();
    } else {
      await handleCOD();
    }
  };

  const handleOrderError = (err) => {
    const data = err.response?.data;
    if (err.response?.status === 401) {
      toast.error("Your session has expired. Please log in again.");
      navigate("/login");
    } else if (err.response?.status === 409 && data?.shortfalls?.length) {
      const lines = data.shortfalls
        .map((s) => `• ${s.name}: need ${s.need}, only ${s.available} left`)
        .join("\n");
      toast.error(`Some ingredients are out of stock:\n${lines}`, { duration: 6000 });
    } else if (data?.code === "EMAIL_NOT_VERIFIED") {
      toast.error("Please verify your email before placing an order.");
    } else {
      toast.error(data?.message || "Failed to place order");
    }
  };

  if (items.length === 0) {
    return (
      <div className="section empty-state">
        <span className="empty-state-icon">🛒</span>
        <h2>Your cart is empty</h2>
        <Link to="/menu" className="btn-primary">Browse Menu</Link>
      </div>
    );
  }

  return (
    <div className="section">
      <p className="section-eyebrow">Almost there!</p>
      <h2 className="section-title">Checkout</h2>

      <form className="checkout-layout" onSubmit={handlePlaceOrder}>
        <div className="checkout-left">
          {/* Delivery Address */}
          <div className="card">
            <h3>📍 Delivery Address</h3>
            <div className="form-group">
              <label>Street / Flat / Area</label>
              <input
                placeholder="e.g. 42, MG Road, Koramangala"
                value={address.street}
                onChange={(e) => setField("street", e.target.value)}
                required
              />
            </div>
            <div className="form-row">
              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "0.35rem", color: "var(--charcoal-mid)" }}>City</label>
                <input placeholder="Bengaluru" value={address.city} onChange={(e) => setField("city", e.target.value)} required />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "0.35rem", color: "var(--charcoal-mid)" }}>State</label>
                <input placeholder="Karnataka" value={address.state} onChange={(e) => setField("state", e.target.value)} required />
              </div>
            </div>
            <div className="form-group">
              <label>Pincode</label>
              <input
                placeholder="560001"
                value={address.pincode}
                onChange={(e) => setField("pincode", e.target.value)}
                required maxLength={6} pattern="\d{6}" title="6-digit pincode"
              />
            </div>
          </div>

          {/* Payment Method */}
          <div className="card">
            <h3>💳 Payment Method</h3>
            <div className="payment-options">
              <label className={`payment-option ${paymentMethod === "cod" ? "active" : ""}`}>
                <input
                  type="radio" name="payment" value="cod"
                  checked={paymentMethod === "cod"}
                  onChange={() => setPaymentMethod("cod")}
                />
                <div>
                  <p style={{ fontWeight: 600, fontSize: "0.9rem" }}>💵 Cash on Delivery</p>
                  <p style={{ fontSize: "0.78rem", color: "var(--charcoal-soft)", marginTop: "2px" }}>Pay when your order arrives</p>
                </div>
              </label>

              <label
                className={`payment-option ${paymentMethod === "razorpay" ? "active" : ""} ${!razorpayAvailable ? "disabled" : ""}`}
                style={!razorpayAvailable ? { opacity: 0.5, cursor: "not-allowed" } : {}}
              >
                <input
                  type="radio" name="payment" value="razorpay"
                  checked={paymentMethod === "razorpay"}
                  onChange={() => razorpayAvailable && setPaymentMethod("razorpay")}
                  disabled={!razorpayAvailable}
                />
                <div>
                  <p style={{ fontWeight: 600, fontSize: "0.9rem" }}>💳 Pay Online</p>
                  <p style={{ fontSize: "0.78rem", color: "var(--charcoal-soft)", marginTop: "2px" }}>
                    {razorpayAvailable ? "Cards, UPI, Net Banking via Razorpay" : "Loading payment gateway…"}
                  </p>
                </div>
              </label>
            </div>

            {paymentMethod === "razorpay" && (
              <p style={{ fontSize: "0.72rem", color: "var(--charcoal-soft)", marginTop: "0.75rem" }}>
                🔒 Payments are processed securely by Razorpay. We never store your card details.
                Use <strong>test card 4111 1111 1111 1111</strong> in test mode.
              </p>
            )}
          </div>

          {/* Order Notes */}
          <div className="card">
            <h3>📝 Special Instructions (optional)</h3>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <textarea
                placeholder="e.g. Extra spicy, no onions, ring the bell…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                style={{ resize: "vertical" }}
              />
            </div>
          </div>
        </div>

        {/* Order Summary */}
        <div className="cart-summary">
          <h3>Order Summary</h3>
          {items.map((i) => {
            const label = i.itemType === "custom"
              ? `Custom Pizza (${i.size})`
              : `${i.pizza.name} (${i.size})`;
            const imageUrl = i.itemType === "menu" ? getPizzaImage(i.pizza) : null;
            return (
              <div key={i.cartId} className="summary-row" style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                {imageUrl && (
                  <img
                    src={imageUrl}
                    alt={i.pizza.name}
                    className="summary-item-img"
                    loading="lazy"
                    onError={(e) => { e.target.src = "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=800&q=80"; }}
                  />
                )}
                <span style={{ maxWidth: "180px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {label} × {i.quantity}
                </span>
                <span>₹{Math.round(i.priceP * i.quantity / 100)}</span>
              </div>
            );
          })}
          <hr />
          <div className="summary-row"><span>Subtotal</span><span>₹{subtotal}</span></div>
          <div className="summary-row"><span>Delivery</span><span>₹{DELIVERY_FEE}</span></div>
          {promoResult && (
            <div className="summary-row" style={{ color: "var(--green)" }}>
              <span>Promo ({promoResult.title})</span>
              <span>−₹{promoResult.discount}</span>
            </div>
          )}
          <div className="summary-row total">
            <span>Est. Total</span>
            <span>₹{subtotal + DELIVERY_FEE - (promoResult?.discount || 0)}</span>
          </div>
          <p style={{ fontSize: "0.7rem", color: "var(--charcoal-soft)", marginTop: "0.4rem" }}>
            * Server recalculates and confirms the final total
          </p>

          {/* Promo code */}
          <div style={{ marginTop: "1rem" }}>
            {promoResult ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--green-light)", border: "1px solid var(--green)", borderRadius: "var(--r-sm)", padding: "0.5rem 0.75rem", fontSize: "0.82rem" }}>
                <span style={{ color: "var(--green)", fontWeight: 600 }}>✓ {promoResult.title} applied</span>
                <button onClick={removePromo} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--charcoal-soft)", fontSize: "1rem", lineHeight: 1 }}>×</button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  value={promoInput}
                  onChange={(e) => { setPromoInput(e.target.value.toUpperCase()); setPromoError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && applyPromo()}
                  placeholder="Promo code"
                  style={{ flex: 1, padding: "0.5rem 0.75rem", border: "1.5px solid var(--cream-border)", borderRadius: "var(--r-sm)", fontSize: "0.85rem", fontFamily: "monospace", textTransform: "uppercase" }}
                />
                <button
                  type="button"
                  onClick={applyPromo}
                  disabled={promoLoading || !promoInput.trim()}
                  className="btn-outline-sm"
                >
                  {promoLoading ? "…" : "Apply"}
                </button>
              </div>
            )}
            {promoError && <p style={{ fontSize: "0.75rem", color: "var(--red)", marginTop: "0.3rem" }}>{promoError}</p>}
          </div>

          <button
            type="submit"
            className="btn-primary"
            style={{ width: "100%", marginTop: "1.25rem" }}
            disabled={loading}
          >
            {loading
              ? "Processing…"
              : paymentMethod === "razorpay"
                ? "Pay Online →"
                : "Place Order (COD)"}
          </button>

          <p style={{ fontSize: "0.72rem", color: "var(--charcoal-soft)", textAlign: "center", marginTop: "0.5rem" }}>
            🔒 Secure checkout · Estimated delivery: 45 min
          </p>
        </div>
      </form>
    </div>
  );
}
