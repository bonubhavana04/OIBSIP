import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext";

const DELIVERY_FEE = 40;

export default function Cart() {
  const { items, removeItem, updateQty, clearCart, subtotal } = useCart();

  if (items.length === 0) {
    return (
      <div className="section empty-state">
        <span className="empty-state-icon">🛒</span>
        <h2>Your cart is empty</h2>
        <p>Add some delicious pizzas to get started.</p>
        <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
          <Link to="/menu" className="btn-primary">Browse Menu</Link>
          <Link to="/builder" className="btn-outline">Build Your Own</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="section">
      <div className="cart-header">
        <h2 className="section-title" style={{ margin: 0 }}>
          Your Cart{" "}
          <span style={{ fontSize: "1rem", fontWeight: 500, color: "var(--charcoal-soft)" }}>
            ({items.length} item{items.length !== 1 ? "s" : ""})
          </span>
        </h2>
        <button className="btn-ghost danger" onClick={clearCart}>Clear Cart</button>
      </div>

      <div className="cart-layout">
        <div className="cart-items">
          {items.map((item) => {
            const isCustom = item.itemType === "custom";
            const desc = isCustom && item.customPizza
              ? [
                  item.customPizza.baseName,
                  item.customPizza.sauceName,
                  item.customPizza.cheeseName,
                  ...(item.customPizza.veggieNames || []),
                ].filter(Boolean).join(" · ")
              : null;

            // Line total computed from paise to avoid rounding drift
            const lineTotal = Math.round(item.priceP * item.quantity / 100);

            return (
              <div key={item.cartId} className="cart-item">
                <div className="cart-item-info">
                  <span
                    className={`veg-dot ${item.pizza.isVeg ? "veg" : "non-veg"}`}
                    title={item.pizza.isVeg ? "Veg" : "Non-Veg"}
                  />
                  <div style={{ minWidth: 0 }}>
                    <p className="cart-item-name">{item.pizza.name}</p>
                    <p className="cart-item-meta">
                      {item.size} · ₹{item.price} each
                    </p>
                    {desc && (
                      <p className="cart-item-meta" style={{ marginTop: 2 }}>{desc}</p>
                    )}
                  </div>
                </div>

                <div className="cart-item-controls">
                  <button
                    className="qty-btn"
                    onClick={() => updateQty(item.cartId, item.quantity - 1)}
                    aria-label="Decrease quantity"
                  >
                    −
                  </button>
                  <span className="qty-display">{item.quantity}</span>
                  <button
                    className="qty-btn"
                    onClick={() => updateQty(item.cartId, item.quantity + 1)}
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>

                <div className="cart-item-total">
                  <span style={{ fontWeight: 700, fontSize: "1rem" }}>
                    ₹{lineTotal}
                  </span>
                  <button
                    className="btn-ghost danger"
                    onClick={() => removeItem(item.cartId)}
                    aria-label="Remove item"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="cart-summary">
          <h3>Order Summary</h3>
          <div className="summary-row"><span>Subtotal</span><span>₹{subtotal}</span></div>
          <div className="summary-row"><span>Delivery Fee</span><span>₹{DELIVERY_FEE}</span></div>
          <div className="summary-row" style={{ fontSize: "0.78rem", color: "var(--charcoal-soft)" }}>
            <span>Taxes</span><span>Included</span>
          </div>
          <div className="summary-row total">
            <span>Total</span>
            <span>₹{subtotal + DELIVERY_FEE}</span>
          </div>
          <p style={{ fontSize: "0.72rem", color: "var(--charcoal-soft)", marginTop: "0.5rem" }}>
            * Final total confirmed by server at checkout
          </p>
          <Link
            to="/checkout"
            className="btn-primary"
            style={{ display: "block", textAlign: "center", marginTop: "1.25rem" }}
          >
            Proceed to Checkout →
          </Link>
          <Link
            to="/menu"
            className="btn-ghost"
            style={{ display: "block", textAlign: "center", marginTop: "0.5rem", width: "100%" }}
          >
            + Add More Items
          </Link>
        </div>
      </div>
    </div>
  );
}
