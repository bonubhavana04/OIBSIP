import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import toast from "react-hot-toast";

const DELIVERY_FEE = 40;

const loadRazorpay = () =>
  new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload  = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

export default function Checkout() {
  const { items, subtotal, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [address, setAddress] = useState({ street: "", city: "", state: "", pincode: "" });
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false); // true while server-side verify is in-flight

  const setField = (k, v) => setAddress((a) => ({ ...a, [k]: v }));

  /** Build the items array the backend expects */
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
      return {
        itemType: "menu",
        pizza:    i.pizza._id,
        size:     i.size,
        quantity: i.quantity,
      };
    });

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    if (!address.street || !address.city || !address.state || !address.pincode)
      return toast.error("Please fill in the complete delivery address");

    setLoading(true);
    try {
      const { data } = await api.post("/orders", {
        items:           buildOrderItems(),
        deliveryAddress: address,
        paymentMethod,
        notes,
      });
      const order = data.order;

      if (paymentMethod === "cod") {
        await api.post("/payments/cod-confirm", { orderId: order._id });
        clearCart();
        toast.success("Order placed successfully! 🎉");
        navigate(`/orders/${order._id}`);
        return;
      }

      // Razorpay online payment
      const loaded = await loadRazorpay();
      if (!loaded) { toast.error("Failed to load Razorpay"); setLoading(false); return; }

      const { data: rzp } = await api.post("/payments/create-order", { orderId: order._id });

      const options = {
        key:         rzp.keyId,
        amount:      rzp.amount,
        currency:    rzp.currency,
        name:        "Cravello",
        description: `Order #${order._id.slice(-8).toUpperCase()}`,
        order_id:    rzp.razorpayOrderId,
        prefill:     { name: user.name, email: user.email, contact: user.phone || "" },
        theme:       { color: "#c0392b" },
        handler: async (response) => {
          // Razorpay calls this after the user completes payment in the modal.
          // We MUST verify the signature on the server — never trust this callback alone.
          setVerifying(true);
          try {
            await api.post("/payments/verify", {
              razorpayOrderId:   response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              orderId:           order._id,
            });
            clearCart();
            toast.success("Payment verified! Order confirmed 🎉");
            navigate(`/orders/${order._id}`);
          } catch (verifyErr) {
            toast.error(verifyErr.response?.data?.message || "Payment verification failed — contact support");
            setLoading(false);
          } finally {
            setVerifying(false);
          }
        },
        modal: { ondismiss: () => { toast("Payment cancelled"); setLoading(false); } },
      };

      try {
        new window.Razorpay(options).open();
      } catch {
        toast.error("Could not open payment window");
        setLoading(false);
      }
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to place order";
      // Surface unverified-email error clearly
      if (err.response?.data?.code === "EMAIL_NOT_VERIFIED") {
        toast.error("Please verify your email before placing an order.");
      } else {
        toast.error(msg);
      }
      setLoading(false);
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
                required
                maxLength={6}
                pattern="\d{6}"
                title="6-digit pincode"
              />
            </div>
          </div>

          {/* Payment Method */}
          <div className="card">
            <h3>💳 Payment Method</h3>
            <div className="payment-options">
              {[
                { value: "cod",       label: "💵 Cash on Delivery", desc: "Pay when your order arrives" },
                { value: "razorpay",  label: "💳 Pay Online",        desc: "Cards, UPI, Net Banking via Razorpay" },
              ].map((opt) => (
                <label key={opt.value} className={`payment-option ${paymentMethod === opt.value ? "active" : ""}`}>
                  <input
                    type="radio"
                    name="payment"
                    value={opt.value}
                    checked={paymentMethod === opt.value}
                    onChange={() => setPaymentMethod(opt.value)}
                  />
                  <div>
                    <p style={{ fontWeight: 600, fontSize: "0.9rem" }}>{opt.label}</p>
                    <p style={{ fontSize: "0.78rem", color: "var(--charcoal-soft)", marginTop: "2px" }}>{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
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
            return (
              <div key={i.cartId} className="summary-row">
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
          <div className="summary-row total">
            <span>Est. Total</span><span>₹{subtotal + DELIVERY_FEE}</span>
          </div>
          <p style={{ fontSize: "0.7rem", color: "var(--charcoal-soft)", marginTop: "0.4rem" }}>
            * Server recalculates and confirms the final total
          </p>

          <button
            type="submit"
            className="btn-primary"
            style={{ width: "100%", marginTop: "1.25rem" }}
            disabled={loading || verifying}
          >
            {verifying
              ? "Verifying payment…"
              : loading
              ? "Processing…"
              : paymentMethod === "cod"
              ? "Place Order (COD)"
              : `Pay ₹${subtotal + DELIVERY_FEE}`}
          </button>

          {paymentMethod === "razorpay" && (
            <p style={{ fontSize: "0.7rem", color: "var(--amber)", textAlign: "center", marginTop: "0.5rem", fontWeight: 600 }}>
              ⚠️ TEST MODE — use Razorpay test cards only
            </p>
          )}

          <p style={{ fontSize: "0.72rem", color: "var(--charcoal-soft)", textAlign: "center", marginTop: "0.5rem" }}>
            🔒 Secure checkout · Estimated delivery: 45 min
          </p>
        </div>
      </form>
    </div>
  );
}
