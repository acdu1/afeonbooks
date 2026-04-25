import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { useListProducts, type Product } from "@workspace/api-client-react";
import { MiniCart } from "@/components/mini-cart";

export interface CartItem {
  productId: number;
  quantity: number;
}

export interface EnrichedCartItem extends CartItem {
  product?: Product;
}

interface CartContextValue {
  items: CartItem[];
  addItem: (productId: number, quantity?: number) => void;
  removeItem: (productId: number) => void;
  updateQty: (productId: number, quantity: number) => void;
  clear: () => void;
  itemCount: number;
  enrichedItems: EnrichedCartItem[];
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  lastAddedId: number | null;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const stored = localStorage.getItem("cart");
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  });
  const [isOpen, setIsOpen] = useState(false);
  const [lastAddedId, setLastAddedId] = useState<number | null>(null);
  const isFirstRender = useRef(true);

  const { data: products } = useListProducts();

  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(items));
  }, [items]);

  // Skip auto-open on initial mount (loading from localStorage shouldn't pop the cart)
  useEffect(() => {
    isFirstRender.current = false;
  }, []);

  const addItem = (productId: number, quantity: number = 1) => {
    setItems((prev) => {
      const existing = prev.find((item) => item.productId === productId);
      if (existing) {
        return prev.map((item) =>
          item.productId === productId ? { ...item, quantity: item.quantity + quantity } : item
        );
      }
      return [...prev, { productId, quantity }];
    });
    setLastAddedId(productId);
    setIsOpen(true);
  };

  const removeItem = (productId: number) => {
    setItems((prev) => prev.filter((item) => item.productId !== productId));
  };

  const updateQty = (productId: number, quantity: number) => {
    setItems((prev) =>
      prev.map((item) => (item.productId === productId ? { ...item, quantity: Math.max(1, quantity) } : item))
    );
  };

  const clear = () => setItems([]);

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const enrichedItems: EnrichedCartItem[] = items.map((item) => ({
    ...item,
    product: products?.find((p) => p.id === item.productId),
  }));

  const openCart = () => setIsOpen(true);
  const closeCart = () => setIsOpen(false);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQty,
        clear,
        itemCount,
        enrichedItems,
        isOpen,
        openCart,
        closeCart,
        lastAddedId,
      }}
    >
      {children}
      <MiniCart />
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
