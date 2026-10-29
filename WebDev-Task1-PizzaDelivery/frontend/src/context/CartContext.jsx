import { createContext, useContext, useState } from "react";

const CartContext = createContext(null);
const CART_KEY = "pizza_cart";

const load = () => {
  try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { return []; }
};
const save = (items) => localStorage.setItem(CART_KEY, JSON.stringify(items));

let _seq = Date.now();
const nextId = () => `cid_${++_seq}`;

/**
 * Each cart item shape:
 *   Menu pizza:   { cartId, itemType:"menu",   pizza:{_id,name,isVeg,sizes,…}, size, priceP, price, quantity }
 *   Custom pizza: { cartId, itemType:"custom", pizza:{_id,name,isVeg},         size, priceP, price, quantity,
 *                   customPizza:{ base, sauce, cheese, veggies:[],
 *                                 baseName, sauceName, cheeseName, veggieNames:[] } }
 *
 * cartId  = stable unique key per line item (used for remove/update)
 * priceP  = paise (integer, authoritative for order submission)
 * price   = rupees (display only, derived from priceP)
 */
export const CartProvider = ({ children }) => {
  const [items, setItems] = useState(() =>
    // Backfill cartId for any items persisted before this version
    load().map((i) => i.cartId ? i : { ...i, cartId: nextId() })
  );

  const update = (next) => { setItems(next); save(next); };

  /** Add a menu pizza to the cart. Merges quantity if same pizza+size already present. */
  const addMenuItem = (pizza, size, quantity = 1) => {
    const sizeData = pizza.sizes.find((s) => s.label === size) || pizza.sizes[0];
    const priceP = sizeData.priceP ?? Math.round((sizeData.price ?? 0) * 100);

    setItems((prev) => {
      const idx = prev.findIndex(
        (i) => i.itemType === "menu" && i.pizza._id === pizza._id && i.size === size
      );
      let next;
      if (idx > -1) {
        next = prev.map((i, index) =>
          index === idx ? { ...i, quantity: i.quantity + quantity } : i
        );
      } else {
        next = [...prev, {
          cartId: nextId(),
          itemType: "menu",
          pizza,
          size,
          priceP,
          price: Math.round(priceP / 100),
          quantity,
        }];
      }
      save(next);
      return next;
    });
  };

  /** Add a custom (builder) pizza. Always adds as a new line item. */
  const addCustomItem = (customPizza, size, priceP, quantity = 1) => {
    const item = {
      cartId: nextId(),
      itemType: "custom",
      pizza: {
        _id: `custom_${Date.now()}`,
        name: "Custom Pizza",
        isVeg: true,
      },
      size,
      priceP,
      price: Math.round(priceP / 100),
      quantity,
      customPizza,
    };
    setItems((prev) => {
      const next = [...prev, item];
      save(next);
      return next;
    });
  };

  const removeItem = (cartId) => {
    update(items.filter((i) => i.cartId !== cartId));
  };

  const updateQty = (cartId, quantity) => {
    if (quantity < 1) return removeItem(cartId);
    update(items.map((i) => (i.cartId === cartId ? { ...i, quantity } : i)));
  };

  const clearCart = () => update([]);

  // Subtotal derived from paise to avoid rounding drift
  const subtotalP  = items.reduce((s, i) => s + i.priceP * i.quantity, 0);
  const subtotal   = Math.round(subtotalP / 100);
  const totalItems = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <CartContext.Provider value={{
      items, addMenuItem, addCustomItem, removeItem, updateQty, clearCart,
      subtotal, subtotalP, totalItems,
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
