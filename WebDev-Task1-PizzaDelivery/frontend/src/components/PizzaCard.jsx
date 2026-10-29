import { useState } from "react";
import { useCart } from "../context/CartContext";
import toast from "react-hot-toast";

const PIZZA_EMOJIS = ["🍕", "🫓", "🧀", "🌶️", "🍅"];

export default function PizzaCard({ pizza, index = 0 }) {
  const { addMenuItem } = useCart();
  const [size, setSize] = useState("Medium");
  const [adding, setAdding] = useState(false);

  const sizeData = pizza.sizes.find((s) => s.label === size) || pizza.sizes[0];
  // Display price in rupees — prefer virtual `price`, fall back to priceP/100
  const displayPrice = sizeData?.price ?? Math.round((sizeData?.priceP ?? 0) / 100);

  const handleAdd = () => {
    setAdding(true);
    addMenuItem(pizza, sizeData.label);
    toast.success(`${pizza.name} added!`);
    setTimeout(() => setAdding(false), 600);
  };

  return (
    <div className="pizza-card">
      {pizza.image ? (
        <img src={pizza.image} alt={pizza.name} className="pizza-card-img" loading="lazy" />
      ) : (
        <div className="pizza-card-img-placeholder">
          {PIZZA_EMOJIS[index % PIZZA_EMOJIS.length]}
        </div>
      )}

      <div className="pizza-card-body">
        <div className="pizza-card-header">
          <h3>{pizza.name}</h3>
          <span className="veg-badge" title={pizza.isVeg ? "Vegetarian" : "Non-Vegetarian"}>
            {pizza.isVeg ? "🟢" : "🔴"}
          </span>
        </div>

        {pizza.ratings?.average > 0 && (
          <div className="pizza-rating">
            ★ {pizza.ratings.average.toFixed(1)}
            <span style={{ color: "var(--charcoal-soft)", fontWeight: 400 }}>
              {" "}· {pizza.category?.name || ""}
            </span>
          </div>
        )}

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
