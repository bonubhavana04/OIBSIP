import { useState } from "react";
import { useCart } from "../context/CartContext";
import toast from "react-hot-toast";
import { getPizzaImage } from "../utils/pizzaImages";

const SPICE_ICON = { mild: "🟡", medium: "🟠", hot: "🔴", "extra-hot": "🔥" };

export default function PizzaCard({ pizza }) {
  const { addMenuItem } = useCart();
  const [size, setSize] = useState("Medium");
  const [adding, setAdding] = useState(false);

  const sizeData = pizza.sizes.find((s) => s.label === size) || pizza.sizes[0];
  const displayPrice = sizeData?.price ?? Math.round((sizeData?.priceP ?? 0) / 100);
  const imageUrl = getPizzaImage(pizza);

  const handleAdd = () => {
    setAdding(true);
    addMenuItem(pizza, sizeData.label);
    toast.success(`${pizza.name} added!`);
    setTimeout(() => setAdding(false), 600);
  };

  return (
    <div className="pizza-card">
      {/* Badges */}
      <div style={{ position: "relative" }}>
        <img
          src={imageUrl}
          alt={pizza.name}
          className="pizza-card-img"
          loading="lazy"
          onError={(e) => { e.target.src = "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=800&q=80"; }}
        />
        <div style={{ position: "absolute", top: "0.5rem", left: "0.5rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          {pizza.isBestseller && (
            <span style={{ background: "#e67e22", color: "#fff", fontSize: "0.65rem", fontWeight: 700, padding: "2px 7px", borderRadius: "20px", letterSpacing: "0.04em" }}>
              ⭐ BESTSELLER
            </span>
          )}
          {pizza.isNewArrival && (
            <span style={{ background: "var(--red)", color: "#fff", fontSize: "0.65rem", fontWeight: 700, padding: "2px 7px", borderRadius: "20px", letterSpacing: "0.04em" }}>
              🆕 NEW
            </span>
          )}
        </div>
      </div>

      <div className="pizza-card-body">
        <div className="pizza-card-header">
          <h3>{pizza.name}</h3>
          <span className="veg-badge" title={pizza.isVeg ? "Vegetarian" : "Non-Vegetarian"}>
            {pizza.isVeg ? "🟢" : "🔴"}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem", flexWrap: "wrap" }}>
          {pizza.ratings?.average > 0 && (
            <span className="pizza-rating" style={{ margin: 0 }}>
              ★ {pizza.ratings.average.toFixed(1)}
            </span>
          )}
          {pizza.category?.name && (
            <span style={{ fontSize: "0.72rem", color: "var(--charcoal-soft)" }}>
              {pizza.category.emoji} {pizza.category.name}
            </span>
          )}
          {pizza.spiceLevel && pizza.spiceLevel !== "mild" && (
            <span style={{ fontSize: "0.72rem", color: "var(--charcoal-soft)" }}>
              {SPICE_ICON[pizza.spiceLevel]} {pizza.spiceLevel}
            </span>
          )}
        </div>

        <p className="pizza-desc">{pizza.description}</p>

        <div className="size-selector">
          {pizza.sizes.map((s) => (
            <button
              key={s.label}
              className={`size-btn ${size === s.label ? "active" : ""}`}
              onClick={() => setSize(s.label)}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="pizza-card-footer">
          <span className="pizza-price">₹{displayPrice}</span>
          <button
            className="btn-primary-sm"
            onClick={handleAdd}
            disabled={adding}
            style={{ minWidth: "100px" }}
          >
            {adding ? "✓ Added!" : "+ Add to Cart"}
          </button>
        </div>
      </div>
    </div>
  );
}
