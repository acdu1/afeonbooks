import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart";
import { useGetContent } from "@workspace/api-client-react";
import { useSchool } from "@/lib/school";
import { formatPrice } from "@/lib/format";
import { ShoppingBag, Plus, Minus, X, Check } from "lucide-react";

export function MiniCart() {
  const { isOpen, closeCart, enrichedItems, itemCount, removeItem, updateQty, lastAddedId } = useCart();
  const { school } = useSchool();
  const { data: content } = useGetContent({ school: school ?? "alvarado" });
  const [highlightId, setHighlightId] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen || lastAddedId == null) return;
    setHighlightId(lastAddedId);
    const t = setTimeout(() => setHighlightId(null), 1800);
    return () => clearTimeout(t);
  }, [isOpen, lastAddedId]);

  const subtotalCents = enrichedItems.reduce((sum, item) => {
    const price = item.product?.priceCents || 0;
    return sum + price * item.quantity;
  }, 0);
  const currency = enrichedItems.find((i) => i.product?.currency)?.product?.currency;
  const accent = content?.accentColor || "#000";

  return (
    <Sheet open={isOpen} onOpenChange={(o) => (o ? null : closeCart())}>
      <SheetContent
        side="right"
        className="mini-cart-sheet w-full sm:max-w-md p-0 bg-[#FAF7F2] border-l border-black/10 flex flex-col"
        style={{ "--theme-accent": accent } as React.CSSProperties}
      >
        <SheetHeader className="px-6 py-5 border-b border-black/10 bg-white">
          <SheetTitle className="flex items-center gap-3 text-base font-bold uppercase tracking-widest">
            <ShoppingBag className="w-5 h-5 stroke-[1.5]" />
            <span>Your Cart</span>
            <span className="ml-auto mr-8 text-xs text-black/50 font-medium normal-case tracking-normal">
              {itemCount} {itemCount === 1 ? "item" : "items"}
            </span>
          </SheetTitle>
          {lastAddedId != null && itemCount > 0 && (
            <div
              key={`${lastAddedId}-${highlightId}`}
              className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-green-700 mt-2 animate-in fade-in slide-in-from-top-1 duration-300"
            >
              <Check className="w-4 h-4" />
              Added to cart
            </div>
          )}
        </SheetHeader>

        {enrichedItems.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8 py-16">
            <div className="w-20 h-20 rounded-full bg-white border border-black/10 flex items-center justify-center mb-6">
              <ShoppingBag className="w-8 h-8 stroke-[1.5] text-black/30" />
            </div>
            <h3 className="text-lg font-bold mb-2">Your cart is empty</h3>
            <p className="text-sm text-black/50 font-medium mb-8">
              Add some books to get started.
            </p>
            <Button
              asChild
              onClick={closeCart}
              className="rounded-full bg-black text-white px-8 h-11 uppercase text-xs tracking-widest font-bold hover:bg-[var(--theme-accent)] transition-colors"
            >
              <Link href="/shop">Browse Shop</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <ul className="space-y-4">
                {enrichedItems.map((item) => {
                  const p = item.product;
                  if (!p) return null;
                  const isHighlight = highlightId === item.productId;
                  return (
                    <li
                      key={item.productId}
                      className={`relative bg-white border ${
                        isHighlight ? "border-[var(--theme-accent)] shadow-[0_0_0_3px_rgba(226,85,59,0.15)]" : "border-black/5"
                      } p-4 flex gap-4 transition-all duration-300`}
                    >
                      <div className="w-16 h-20 bg-[#FAF7F2] shrink-0 flex items-center justify-center p-1">
                        <img
                          src={p.imageUrl || "https://placehold.co/100x150?text=Img"}
                          alt={p.name}
                          className="w-full h-full object-contain mix-blend-multiply"
                        />
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="font-bold text-sm leading-tight truncate">{p.name}</p>
                          <button
                            type="button"
                            onClick={() => removeItem(item.productId)}
                            aria-label={`Remove ${p.name}`}
                            className="text-black/30 hover:text-black transition-colors shrink-0"
                          >
                            <X className="w-4 h-4 stroke-[1.5]" />
                          </button>
                        </div>
                        <div className="mt-auto flex items-center justify-between gap-2">
                          <div className="inline-flex items-center border border-black/15">
                            <button
                              type="button"
                              onClick={() => updateQty(item.productId, item.quantity - 1)}
                              disabled={item.quantity <= 1}
                              aria-label="Decrease quantity"
                              className="w-8 h-8 flex items-center justify-center hover:bg-[#FAF7F2] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                              <Minus className="w-3 h-3 stroke-[2]" />
                            </button>
                            <span className="w-8 text-center text-sm font-bold tabular-nums">{item.quantity}</span>
                            <button
                              type="button"
                              onClick={() => updateQty(item.productId, item.quantity + 1)}
                              aria-label="Increase quantity"
                              className="w-8 h-8 flex items-center justify-center hover:bg-[#FAF7F2] transition-colors"
                            >
                              <Plus className="w-3 h-3 stroke-[2]" />
                            </button>
                          </div>
                          <p className="font-bold text-sm tabular-nums">
                            {formatPrice(p.priceCents * item.quantity, p.currency)}
                          </p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="border-t border-black/10 bg-white px-6 py-5 space-y-4">
              <div className="flex items-baseline justify-between">
                <span className="text-xs uppercase tracking-widest text-black/50 font-bold">Subtotal</span>
                <span className="text-2xl font-bold tabular-nums">{formatPrice(subtotalCents, currency)}</span>
              </div>
              <p className="text-xs text-black/50 font-medium">Shipping calculated at checkout.</p>
              <div className="flex flex-col gap-2 pt-1">
                <Button
                  asChild
                  onClick={closeCart}
                  className="w-full h-12 rounded-none bg-black hover:bg-[var(--theme-accent)] text-white text-xs uppercase tracking-widest font-bold transition-colors"
                >
                  <Link href="/checkout">Checkout</Link>
                </Button>
                <Button
                  asChild
                  onClick={closeCart}
                  variant="outline"
                  className="w-full h-12 rounded-none bg-transparent border border-black/20 hover:bg-[#FAF7F2] text-xs uppercase tracking-widest font-bold"
                >
                  <Link href="/cart">View Full Cart</Link>
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
