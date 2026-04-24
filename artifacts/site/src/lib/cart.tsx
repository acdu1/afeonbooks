import React, { createContext, useContext, useEffect, useState } from "react";
import { useListProducts } from "@workspace/api-client-react";

export interface CartItem {
  productId: number;
  quantity: number;
}

interface CartContextValue {
  items: CartItem[];
  addItem: (productId: number, quantity?: number) => void;
  removeItem: (productId: number) => void;
  updateQty: (productId: number, quantity: number) => void;
  clear: () => void;
  itemCount: number;
  enrichedItems: Array<CartItem & { product?: any }>;
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

  const { data: products } = useListProducts();

  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(items));
  }, [items]);

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

  const enrichedItems = items.map((item) => ({
    ...item,
    product: products?.find((p) => p.id === item.productId),
  }));

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQty, clear, itemCount, enrichedItems }}>
      {children}
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
