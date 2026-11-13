import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import api from "../api/axios";
import toast from "react-hot-toast";
import {
  getSizeImage,
  getBaseImage,
  getSauceImage,
  getCheeseImage,
  getToppingImage,
  INGREDIENT_FALLBACK,
} from "../utils/pizzaImages";

const STEPS = [
  { id: 1, label: "Size",    emoji: "📏" },
  { id: 2, label: "Base",    emoji: "🫓" },
  { id: 3, label: "Sauce",   emoji: "🍅" },
  { id: 4, label: "Cheese",  emoji: "🧀" },
  { id: 5, label: "Toppings", emoji: "🥦" },
  { id: 6, label: "Review",  emoji: "✅" },
];

const SIZES = [
  { label: "Small",  multiplier: 0.8,  desc: "6 inch · serves 1" },
  { label: "Medium", multiplier: 1.0,  desc: "9 inch · serves 2" },
  { label: "Large",  multiplier: 1.3,  desc: "12 inch · serves 3–4" },
];

const BUILDER_BASE_PRICE_P = 19900;

function OptionCard({ item, selected, multi, onToggle, onDeselect }) {
  const isSelected = multi
    ? selected.some((s) => s._id === item._id)
    : selected?._id === item._id;

  const unavailable = item.isAvailable === false;

  const imageUrl =
    item.category === "base"   ? getBaseImage(item.name) :
    item.category === "sauce"  ? getSauceImage(item.name) :
    item.category === "cheese" ? getCheeseImage(item.name) :
                                 getToppingImage(item.name);

  return (
    <div
      className={`pizza-builder-card ${isSelected ? (multi ? "multi-selected" : "selected") : ""} ${unavailable ? "disabled" : ""}`}
      onClick={() => {
        if (unavailable) return;
        !multi && isSelected && onDeselect ? onDeselect() : onToggle(item);
      }}
      role="button"
      tabIndex={unavailable ? -1 : 0}
      onKeyDown={(e) => {
        if (unavailable) return;
        if (e.key === "Enter") (!multi && isSelected && onDeselect ? onDeselect() : onToggle(item));
      }}
      aria-pressed={isSelected}
      aria-disabled={unavailable}
    >
      {isSelected && (
        <span className="pizza-builder-check">✓</span>
      )}
      <div className="pizza-builder-card-image">
        <img
          src={imageUrl}
          alt={item.name}
          onError={(e) => { e.target.src = INGREDIENT_FALLBACK; }}
        />
      </div>
      <div className="pizza-builder-card-content">
        <p className="pizza-builder-card-name">{item.name}</p>
        {item.description && <p className="pizza-builder-card-desc">{item.description}</p>}
        <p className="pizza-builder-card-price">
          {unavailable
            ? "Unavailable"
            : item.priceP === 0
              ? "Included"
              : `+₹${Math.round(item.priceP / 100)}`}
        </p>
      </div>
    </div>
  );
}

function SizeCard({ sizeObj, selected, onSelect }) {
  const isSelected = selected === sizeObj.label;
  const imageUrl = getSizeImage(sizeObj.label);
  return (
    <div
      className={`pizza-builder-card ${isSelected ? "selected" : ""}`}
      onClick={() => onSelect(sizeObj.label)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onSelect(sizeObj.label)}
      aria-pressed={isSelected}
    >
      {isSelected && <span className="pizza-builder-check">✓</span>}
      <div className="pizza-builder-card-image">
        <img
          src={imageUrl}
          alt={`${sizeObj.label} pizza`}
          onError={(e) => { e.target.src = INGREDIENT_FALLBACK; }}
        />
      </div>
      <div className="pizza-builder-card-content">
        <p className="pizza-builder-card-name">{sizeObj.label}</p>
        <p className="pizza-builder-card-desc">{sizeObj.desc}</p>
        <p className="pizza-builder-card-price">
          {sizeObj.multiplier < 1 ? "−20%" : sizeObj.multiplier > 1 ? "+30%" : "Base price"}
        </p>
      </div>
    </div>
  );
}

export default function PizzaBuilder() {
  const navigate = useNavigate();
  const { addCustomItem } = useCart();

  const [step,    setStep]    = useState(1);
  const [size,    setSize]    = useState("Medium");
  const [base,    setBase]    = useState(null);
  const [sauce,   setSauce]   = useState(null);
  const [cheese,  setCheese]  = useState(null);
  const [veggies, setVeggies] = useState([]);

  const [inventory,   setInventory]   = useState({ base: [], sauce: [], cheese: [], veggie: [] });
  const [loadingInv,  setLoadingInv]  = useState(true);
  const [invError,    setInvError]    = useState(false);

  useEffect(() => {
    api.get("/inventory")
      .then(({ data }) => { setInventory(data.grouped); setLoadingInv(false); })
      .catch(() => { setInvError(true); setLoadingInv(false); });
  }, []);

  const sizeMultiplier = SIZES.find((s) => s.label === size)?.multiplier ?? 1;

  const ingredientP =
    (base?.priceP   ?? 0) +
    (sauce?.priceP  ?? 0) +
    (cheese?.priceP ?? 0) +
    veggies.reduce((s, v) => s + v.priceP, 0);

  const estimatedPriceP = Math.round((BUILDER_BASE_PRICE_P + ingredientP) * sizeMultiplier);
  const estimatedPrice  = Math.round(estimatedPriceP / 100);

  const toggleVeggie = (v) =>
    setVeggies((prev) =>
      prev.some((x) => x._id === v._id) ? prev.filter((x) => x._id !== v._id) : [...prev, v]
    );

  const canProceed = () => {
    if (step === 2) return !!base;
    if (step === 3) return !!sauce;
    if (step === 4) return !!cheese;
    return true;
  };

  const handleAddToCart = () => {
    if (!base || !sauce || !cheese) {
      toast.error("Please complete all required steps");
      return;
    }
    addCustomItem(
      {
        base:        base._id,
        sauce:       sauce._id,
        cheese:      cheese._id,
        veggies:     veggies.map((v) => v._id),
        baseName:    base.name,
        sauceName:   sauce.name,
        cheeseName:  cheese.name,
        veggieNames: veggies.map((v) => v.name),
      },
      size,
      estimatedPriceP
    );
    toast.success("Custom pizza added to cart!");
    navigate("/cart");
  };

  if (loadingInv) return <div className="loading"><div className="spinner" /></div>;

  if (invError) {
    return (
      <div className="section empty-state">
        <span className="empty-state-icon">⚠️</span>
        <h2>Could not load builder</h2>
        <p>Unable to fetch ingredients. Please try again.</p>
        <button className="btn-primary" onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  const stepContent = () => {
    switch (step) {
      case 1:
        return (
          <>
            <p className="section-subtitle">Choose your pizza size.</p>
            <div className="pizza-builder-grid size-grid">
              {SIZES.map((s) => (
                <SizeCard key={s.label} sizeObj={s} selected={size} onSelect={setSize} />
              ))}
            </div>
          </>
        );
      case 2:
        return (
          <>
            <p className="section-subtitle">Choose your crust — the foundation of your pizza.</p>
            <div className="pizza-builder-grid">
              {inventory.base.map((b) => (
                <OptionCard key={b._id} item={b} selected={base} onToggle={setBase} onDeselect={() => setBase(null)} />
              ))}
            </div>
          </>
        );
      case 3:
        return (
          <>
            <p className="section-subtitle">Pick a sauce to spread across your base.</p>
            <div className="pizza-builder-grid">
              {inventory.sauce.map((s) => (
                <OptionCard key={s._id} item={s} selected={sauce} onToggle={setSauce} onDeselect={() => setSauce(null)} />
              ))}
            </div>
          </>
        );
      case 4:
        return (
          <>
            <p className="section-subtitle">Select your cheese — one choice only.</p>
            <div className="pizza-builder-grid">
              {inventory.cheese.map((c) => (
                <OptionCard key={c._id} item={c} selected={cheese} onToggle={setCheese} onDeselect={() => setCheese(null)} />
              ))}
            </div>
          </>
        );
      case 5:
        return (
          <>
            <p className="section-subtitle">Add as many toppings as you like (optional).</p>
            <div className="pizza-builder-grid">
              {inventory.veggie.map((v) => (
                <OptionCard key={v._id} item={v} selected={veggies} multi onToggle={toggleVeggie} />
              ))}
            </div>
          </>
        );
      case 6:
        return (
          <div className="review-card">
            <h3 className="review-title">Your Custom Pizza</h3>
            <div className="review-summary">
              <div className="review-row">
                <span className="review-label">Size</span>
                <span className="review-value">{size}</span>
              </div>
              <div className="review-row">
                <span className="review-label">Base</span>
                <span className="review-value">{base?.name ?? "—"}</span>
              </div>
              <div className="review-row">
                <span className="review-label">Sauce</span>
                <span className="review-value">{sauce?.name ?? "—"}</span>
              </div>
              <div className="review-row">
                <span className="review-label">Cheese</span>
                <span className="review-value">{cheese?.name ?? "—"}</span>
              </div>
              <div className="review-row">
                <span className="review-label">Toppings</span>
                <span className="review-value">{veggies.length > 0 ? veggies.map((v) => v.name).join(", ") : "None"}</span>
              </div>
            </div>

            <div className="review-price-breakdown">
              <div className="review-price-row">
                <span>Base pizza ({size})</span>
                <span>₹{Math.round(BUILDER_BASE_PRICE_P * sizeMultiplier / 100)}</span>
              </div>
              {base?.priceP > 0 && (
                <div className="review-price-row">
                  <span>{base.name}</span><span>+₹{Math.round(base.priceP / 100)}</span>
                </div>
              )}
              {sauce?.priceP > 0 && (
                <div className="review-price-row">
                  <span>{sauce.name}</span><span>+₹{Math.round(sauce.priceP / 100)}</span>
                </div>
              )}
              {cheese?.priceP > 0 && (
                <div className="review-price-row">
                  <span>{cheese.name}</span><span>+₹{Math.round(cheese.priceP / 100)}</span>
                </div>
              )}
              {veggies.map((v) => (
                <div key={v._id} className="review-price-row">
                  <span>{v.name}</span><span>+₹{Math.round(v.priceP / 100)}</span>
                </div>
              ))}
              <div className="review-price-total">
                <span>Estimated Total</span>
                <span>₹{estimatedPrice}</span>
              </div>
              <p className="review-price-note">
                * Server recalculates and confirms the final price at checkout
              </p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="builder-page">
      <header className="builder-header">
        <div className="builder-header-content">
          <p className="builder-eyebrow">Craft your perfect pizza</p>
<h1 className="builder-title">Build Your Own Pizza</h1>
          <p className="builder-intro">Choose your size, crust, sauce, cheese and toppings to build a pizza exactly the way you like it.</p>
        </div>
      </header>

      <div className="builder-progress">
        {STEPS.map((s, i) => {
          const done   = step > s.id;
          const active = step === s.id;
          return (
            <div key={s.id} className={`builder-step ${done ? "done" : ""} ${active ? "active" : ""}`}>
              <div
                className="builder-step-num"
                style={{ cursor: done ? "pointer" : "default" }}
                onClick={() => done && setStep(s.id)}
                title={done ? `Go back to ${s.label}` : ""}
              >
                {done ? "✓" : s.emoji}
              </div>
              <p className="builder-step-label">{s.label}</p>
              {i < STEPS.length - 1 && (
                <div className={`builder-step-line ${done ? "done" : ""}`} />
              )}
            </div>
          );
        })}
      </div>

      <div className="builder-summary-bar">
        <div className="builder-selections">
          <span className="selection-tag">📏 {size}</span>
          {base   && <span className="selection-tag">{base.emoji}   {base.name}</span>}
          {sauce  && <span className="selection-tag">{sauce.emoji}  {sauce.name}</span>}
          {cheese && <span className="selection-tag">{cheese.emoji} {cheese.name}</span>}
          {veggies.map((v) => <span key={v._id} className="selection-tag">{v.emoji} {v.name}</span>)}
          {!base && !sauce && !cheese && (
            <span style={{ color: "var(--charcoal-soft)", fontSize: "0.85rem" }}>
              Your selections will appear here…
            </span>
          )}
        </div>
        <div className="builder-total-section">
          <p className="builder-total-label">{size} pizza · est. — confirmed at checkout</p>
          <p className="builder-total">₹{estimatedPrice}</p>
        </div>
      </div>

      <div className="builder-step-content">
        <h3 className="builder-step-heading">
          Step {step}: {STEPS[step - 1].label}
          {step >= 2 && step <= 4 && (
            <span className="builder-required">*required</span>
          )}
        </h3>
        {stepContent()}
      </div>

      <div className="builder-nav">
        <button
          className="btn-outline"
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          disabled={step === 1}
        >
          ← Back
        </button>

        {step < 6 ? (
          <button
            className="btn-primary"
            onClick={() => {
              if (!canProceed()) {
                toast.error(`Please select a ${STEPS[step - 1].label.toLowerCase()} to continue`);
                return;
              }
              setStep((s) => s + 1);
            }}
          >
            Next: {STEPS[step].label} →
          </button>
        ) : (
          <button className="btn-primary btn-add-to-cart" onClick={handleAddToCart}>
            🛒 Add to Cart — ₹{estimatedPrice}
          </button>
        )}
      </div>
    </div>
  );
}
