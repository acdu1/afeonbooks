import React, { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useGetContent, useListProducts } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { formatPrice } from "@/lib/format";
import { useCart } from "@/lib/cart";
import { authApiRequest, createAuthEntryUrl, useAuth } from "@/lib/auth";
import { toast } from "sonner";

export default function RedeemPages() {
  const [, setLocation] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { data: content } = useGetContent();
  const { data: products, isLoading } = useListProducts();
  const { addItem } = useCart();
  const [balance, setBalance] = useState(0);
  const loyaltyPagesPerDollar = content?.loyaltyPagesPerDollar ?? 50;
  const redemptionEnabled = loyaltyPagesPerDollar > 0;

  useEffect(() => {
    if (!user) {
      setBalance(0);
      return;
    }

    authApiRequest<{ balance: number }>("/api/auth/loyalty")
      .then((data) => setBalance(data.balance))
      .catch(() => setBalance(0));
  }, [user]);

  const activeProducts = products?.filter((product) => product.active) ?? [];

  const pagesRequiredFor = (priceCents: number) =>
    Math.ceil(priceCents / 100) * loyaltyPagesPerDollar;

  const handleRedeem = (product: { id: number; name: string; priceCents: number; currency: string }) => {
    if (!user) {
      window.location.assign(createAuthEntryUrl(false));
      return;
    }

    const pagesRequired = pagesRequiredFor(product.priceCents);
    if (!redemptionEnabled) {
      toast.error("Page redemption is currently disabled.");
      return;
    }
    if (balance < pagesRequired) {
      toast.error(`You need ${pagesRequired.toLocaleString()} Pages for ${product.name}.`);
      return;
    }

    addItem(product.id);
    toast.success(`${product.name} added to cart. Redeem your Pages at checkout.`);
    setLocation("/checkout");
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#FAF7F2]">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-black border-t-transparent animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen w-full flex flex-col font-sans bg-[#FAF7F2]"
      style={{ "--theme-accent": content?.accentColor || "#000" } as React.CSSProperties}
    >
      <SiteHeader />

      <main className="flex-1 w-full px-6 py-16 md:py-20">
        <div className="mx-auto max-w-[1200px]">
          <div className="mb-10 flex flex-col gap-4 border border-[#B8860B] bg-[#D4A72C] px-5 py-5 text-black md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em]">Pages</p>
              <h1 className="mt-2 text-3xl font-bold md:text-4xl">Redeem your Pages</h1>
            </div>
            <div className="text-left md:text-right">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-black/65">Available</p>
              <p className="mt-1 text-2xl font-bold">{user ? balance.toLocaleString() : 0} Pages</p>
            </div>
          </div>
          {!redemptionEnabled && (
            <p className="mb-8 border border-black/10 bg-white p-4 text-sm text-black/60">
              Page redemption is currently disabled.
            </p>
          )}

          {!user ? (
            <div className="rounded-none border border-black/10 bg-white p-8 text-center shadow-sm">
              <p className="text-lg font-medium text-black/70">Log in to redeem your Pages on a product.</p>
              <Button asChild className="mt-6 rounded-none bg-black px-8 text-white hover:bg-[var(--theme-accent)]">
                <a href={createAuthEntryUrl(false)}>Sign in</a>
              </Button>
            </div>
          ) : (
            <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
              {activeProducts.map((product) => {
                const pagesRequired = pagesRequiredFor(product.priceCents);
                const canRedeem = redemptionEnabled && balance >= pagesRequired;
                return (
                  <div key={product.id} className="flex flex-col border border-black/10 bg-white p-5 shadow-sm">
                    <img
                      src={product.imageUrl || "https://placehold.co/400x600?text=No+Image"}
                      alt={product.name}
                      className="h-64 w-full object-contain bg-[#FAF7F2] p-4"
                    />
                    <div className="mt-5 flex flex-1 flex-col">
                      <h2 className="text-xl font-bold">{product.name}</h2>
                      <p className="mt-2 text-sm text-black/60">{formatPrice(product.priceCents, product.currency)}</p>
                      <p className="mt-2 text-xs font-bold uppercase tracking-[0.2em] text-black/45">
                        {pagesRequired.toLocaleString()} Pages needed
                      </p>

                      <div className="mt-auto pt-5">
                        <Button
                          onClick={() => handleRedeem(product)}
                          className="w-full rounded-none bg-black text-white hover:bg-[var(--theme-accent)] disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={!canRedeem}
                        >
                          {!redemptionEnabled ? "Redemption unavailable" : canRedeem ? "Redeem with Pages" : "Need more Pages"}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {user && activeProducts.length === 0 && (
            <div className="mt-8 border border-black/10 bg-white p-8 text-center text-black/60">
              No products are currently available for redemption.
            </div>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
