import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/lib/cart";
import { UtmProvider } from "@/lib/utm";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Shop from "@/pages/shop";
import Product from "@/pages/product";
import Cart from "@/pages/cart";
import Checkout from "@/pages/checkout";
import Order from "@/pages/order";
const queryClient = new QueryClient();

import React from 'react';
import { SchoolProvider } from "@/lib/school";
import { SchoolPicker } from "@/components/school-picker";
import { setBaseUrl } from "@workspace/api-client-react";

const apiBaseUrl = import.meta.env.VITE_API_URL;
if (apiBaseUrl) {
  setBaseUrl(apiBaseUrl);
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/shop" component={Shop} />
      <Route path="/product/:id" component={Product} />
      <Route path="/cart" component={Cart} />
      <Route path="/checkout" component={Checkout} />
      <Route path="/order/:id" component={Order} />
      <Route component={NotFound} />
    </Switch>
  );
}

function useImageProtection() {
  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest(".allow-select")) return;
      if (target.tagName === "IMG" || target.closest("img")) {
        e.preventDefault();
      }
    };
    const onDragStart = (e: DragEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest(".allow-select")) return;
      if (target.tagName === "IMG") {
        e.preventDefault();
      }
    };
    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("dragstart", onDragStart);
    return () => {
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("dragstart", onDragStart);
    };
  }, []);
}

function App() {
  useImageProtection();
  return (
    <QueryClientProvider client={queryClient}>
      <UtmProvider>
        <SchoolProvider>
          <CartProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
          </CartProvider>
          <SchoolPicker />
        </SchoolProvider>
      </UtmProvider>
    </QueryClientProvider>
  );
}

export default App;
