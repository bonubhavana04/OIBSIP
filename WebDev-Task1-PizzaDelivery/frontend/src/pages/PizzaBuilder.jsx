import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import api from "../api/axios";
import toast from "react-hot-toast";

const STEPS = [
  { id: 1, label: "Base",    emoji: "🫓" },
  { id: 2, label: "Sauce",   emoji: "🍅" },
  { id: 3, label: "Cheese",  emoji: "🧀" },
  { id: 4, label: "Veggies", emoji: "🥦" },
];

const SIZES = [
  { label: "Small",  multiplier: 0.8 },
  { label: "Medium", multiplier: 1.0 },
  { label: "Large",  multiplier: 1.3 },
];

// Base price in paise (must match backend BUILDER_BASE_PRICE_P = 19900)
const BUILDER_BASE_PRICE_P = 19900;

function OptionCard({ item, selected, multi, onToggle, onDeselect }) {
  const isSelected = multi
    ? selected.some((s) => s._id === item._id)
    : selected?._id === item._id;

  return (
    <div
      className={`builder-option ${isSelected ? (multi ? "multi-selected" : "selected") : ""}`}
      onClick={() => (!multi && isSelected && onDeselect ? onDeselect() : onToggle(item))}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && (!multi && isSelected && onDeselect ? onDeselect() : onToggle(item))}
      aria-pressed={isSelected}
    >
      {isSelected && <span className="builder-option-check">✓</span>}
      <span className="builder-option-emoji">{item.emoji}</span>
      <p className="builder-option-name">{item.name}</p>
      {item.description && <p className="builder-option-desc">{item.description}</p>}
      <p className="builder-option-price">
        {item.priceP === 0 ? "Included" : `+₹${Math.round(item.priceP / 100)}`}
      </p>
    </div>
  );
}

export default function PizzaBuilder() {
  const navigate = useNavigate();
  const { addCustomItem } = useCart();

  const [step, setStep] = useState(1);
  const [base,    setBase]    = useState(null);
  const [sauce,   setSauce]   = useState(null);
  const [cheese,  setCheese]  = useState(null);
  const [veggies, setVeggies] = useState([]);
  const [size,    setSize]    = useState("Medium");

  // Inventory data from API
  const [inventory, setInventory] = useState({ base: [], sauce: [], cheese: [], veggie: [] });
  const [loadingInv, setLoadingInv] = useState(true);
  const [invError,   setInvError]   = useState(false);

  useEffect(() => {
    api.get("/inventory")
      .then(({ data }) => {
        setInventory(data.grouped);
        setLoadingInv(false);
      })
      .catch(() => {
        setInvError(true);
        setLoadingInv(false);
      });
  }, []);

  const sizeMultiplier = SIZES.find((s) => s.label === size)?.multiplier ?? 1;

  // Preliminary total in paise (display only — server recalculates authoritatively)
  const ingredientP =
    (base?.priceP   ?? 0) +
    (sauce?.priceP  ?? 0) +
    (cheese?.priceP ?? 0) +
    veggies.reduce((s, v) => s + v.priceP, 0);

  const estimatedPriceP = Math.round((BUILDER_BASE_PRICE_P + ingredientP) * sizeMultiplier);
  const estimatedPrice  = Math.round(estimatedPriceP / 100);

  const toggleVeggie = (v) => {
    setVeggies((prev) =>
      prev.some((x) => x._id === v._id) ? prev.filter((x) => x._id !== v._id) : [...prev, v]
    );
  };

  const canProceed = () => {
    if (step === 1) return !!base;
    if (step === 2) return !!sauce;
    if (step === 3) return !!cheese;
    return true;
  };

  const handleAddToCart = () => {
    if (!base || !sauce || !cheese) {
      toast.error("Please complete all required steps");
      return;
    }

    const customPizza = {
      base:        base._id,
      sauce:       sauce._id,
      cheese:      cheese._id,
      veggies:     veggies.map((v) => v._id),
      baseName:    base.name,
      sauceName:   sauce.name,
      cheeseName:  cheese.name,
      veggieNames: veggies.map((v) => v.name),
    };

    addCustomItem(customPizza, size, estimatedPriceP);
    toast.success("Custom pizza added to cart!");
    navigate("/cart");
  };

  if (loadingInv) {
    return <div className="loading"><div className="spinner" /></div>;
  }

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
            <p className="section-subtitle">Choose your crust — the foundation of your pizza.</p>
            <div className="builder-options">
              {inventory.base.map((b) => (
                <OptionCard key={b._id} item={b} selected={base} onToggle={setBase} onDeselect={() => setBase(null)} />
              ))}
            </div>
          </>
        );
      case 2:
        return (
          <>
            <p className="section-subtitle">Pick a sauce to spread across your base.</p>
            <div className="builder-options">
              {inventory.sauce.map((s) => (
                <OptionCard key={s._id} item={s} selected={sauce} onToggle={setSauce} onDeselect={() => setSauce(null)} />
              ))}
            </div>
          </>
        );
      case 3:
        return (
          <>
            <p className="section-subtitle">Select your cheese — one choice only.</p>
            <div className="builder-options">
              {inventory.cheese.map((c) => (
                <OptionCard key={c._id} item={c} selected={cheese} onToggle={setCheese} onDeselect={() => setCheese(null)} />
              ))}
            </div>
          </>
        );
      case 4:
        return (
          <>
            <p className="section-subtitle">Add as many veggies as you like (optional).</p>
            <div className="builder-options">
              {inventory.veggie.map((v) => (
                <OptionCard key={v._id} item={v} selected={veggies} multi onToggle={toggleVeggie} />
              ))}
            </div>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="builder-page">
      <p className="section-eyebrow">Craft your perfect pizza</p>
      <h2 className="section-title" style={{ marginBottom: "0.5rem" }}>Pizza Builder</h2>

      {/* Progress stepper */}
      <div className="builder-progress">
        {STEPS.map((s, i) => {
          const done   = step > s.id;
          const active = step === s.id;
          return (
            <div key={s.id} className={`builder-step ${done ? "done" : ""} ${active ? "active" : ""}`}>
              <div className="builder-step-num">{done ? "✓" : s.emoji}</div>
              <p className="builder-step-label">{s.label}</p>
              {i < STEPS.length - 1 && (
                <div className={`builder-step-line ${done ? "done" : ""}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Size selector */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--charcoal-mid)" }}>Size:</span>
        {SIZES.map((s) => (
          <button
            key={s.label}
            className={`size-btn ${size === s.label ? "active" : ""}`}
            onClick={() => setSize(s.label)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Summary bar */}
      <div className="builder-summary-bar">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", flex: 1 }}>
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
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <p style={{ fontSize: "0.72rem", color: "var(--charcoal-soft)", marginBottom: "2px" }}>{size} pizza</p>
          <p className="builder-total">₹{estimatedPrice}</p>
          <p style={{ fontSize: "0.68rem", color: "var(--charcoal-soft)" }}>est. — confirmed at checkout</p>
        </div>
      </div>

      {/* Step content */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem", marginBottom: "0.25rem", color: "var(--charcoal)" }}>
          Step {step}: {STEPS[step - 1].label}
          {step < 4 && <span style={{ color: "var(--red)", fontSize: "0.75rem", marginLeft: "0.5rem" }}>*required</span>}
        </h3>
        {stepContent()}
      </div>

      {/* Navigation */}
      <div className="builder-nav">
        <button
          className="btn-outline"
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          disabled={step === 1}
        >
          ← Back
        </button>

        {step < 4 ? (
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
          <button className="btn-primary" onClick={handleAddToCart}>
            🛒 Add to Cart — ₹{estimatedPrice}
          </button>
        )}
      </div>
    </div>
  );
}
