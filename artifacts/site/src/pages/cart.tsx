import { Link } from "wouter";
import { useGetContent } from "@workspace/api-client-react";
import { useSchool } from "@/lib/school";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { formatPrice } from "@/lib/format";
import { useCart } from "@/lib/cart";
import { Minus, Plus, X } from "lucide-react";

export default function Cart() {
  const { school } = useSchool();
  const { data: content } = useGetContent({ school: school ?? "alvarado" });
  const { enrichedItems, updateQty, removeItem, itemCount } = useCart();

  const subtotalCents = enrichedItems.reduce((sum, item) => {
    const price = item.product?.priceCents || 0;
    return sum + price * item.quantity;
  }, 0);

  return (
    <div 
      className="min-h-screen w-full flex flex-col font-sans bg-[#FAF7F2]"
      style={{ "--theme-accent": content?.accentColor || "#000" } as React.CSSProperties}
    >
      <SiteHeader />

      <main className="flex-1 w-full px-6 py-12 md:py-24">
        <div className="max-w-[1000px] mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-16 text-center md:text-left">
            Your Cart
          </h1>

          {itemCount === 0 ? (
            <div className="text-center py-20 bg-white border border-black/5">
              <p className="text-xl text-black/50 mb-8 font-medium">Your cart is empty.</p>
              <Button asChild className="rounded-full px-8 py-6 h-auto text-[15px] bg-black hover:bg-[var(--theme-accent)] text-white uppercase tracking-widest font-bold transition-colors">
                <Link href="/shop">Continue Shopping</Link>
              </Button>
            </div>
          ) : (
            <div className="flex flex-col lg:flex-row gap-12 lg:gap-20">
              <div className="w-full lg:w-2/3">
                <div className="border-b border-black/10 pb-4 mb-8 hidden md:grid grid-cols-12 gap-4 text-xs font-bold uppercase tracking-widest text-black/40">
                  <div className="col-span-6">Product</div>
                  <div className="col-span-3 text-center">Quantity</div>
                  <div className="col-span-3 text-right">Total</div>
                </div>

                <div className="space-y-8">
                  {enrichedItems.map((item) => {
                    const p = item.product;
                    if (!p) return null;

                    return (
                      <div key={item.productId} className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-4 items-center py-6 border-b border-black/5">
                        <div className="col-span-1 md:col-span-6 flex gap-6 items-center">
                          <Link href={`/product/${p.id}`} className="w-24 h-32 bg-white p-2 shrink-0 border border-black/5 flex items-center justify-center">
                            <img src={p.imageUrl || "https://placehold.co/200x300?text=No+Image"} alt={p.name} className="w-full h-full object-contain mix-blend-multiply" />
                          </Link>
                          <div className="flex flex-col">
                            <Link href={`/product/${p.id}`} className="text-lg font-bold hover:text-[var(--theme-accent)] transition-colors mb-2">
                              {p.name}
                            </Link>
                            <p className="text-black/60 font-medium">{formatPrice(p.priceCents, p.currency)}</p>
                          </div>
                        </div>

                        <div className="col-span-1 md:col-span-3 flex items-center justify-between md:justify-center gap-4">
                          <span className="md:hidden text-xs font-bold uppercase tracking-widest text-black/40">Quantity:</span>
                          <div className="flex items-center border border-black h-10 w-28 bg-white">
                            <button 
                              onClick={() => updateQty(item.productId, item.quantity - 1)}
                              className="w-8 h-full flex items-center justify-center text-black/50 hover:text-black transition-colors"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="flex-1 text-center font-bold text-sm">{item.quantity}</span>
                            <button 
                              onClick={() => updateQty(item.productId, item.quantity + 1)}
                              className="w-8 h-full flex items-center justify-center text-black/50 hover:text-black transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        <div className="col-span-1 md:col-span-3 flex items-center justify-between md:justify-end gap-4 relative">
                          <span className="md:hidden text-xs font-bold uppercase tracking-widest text-black/40">Total:</span>
                          <div className="text-lg font-medium">
                            {formatPrice(p.priceCents * item.quantity, p.currency)}
                          </div>
                          <button 
                            onClick={() => removeItem(item.productId)}
                            className="absolute -top-2 right-0 md:static md:ml-4 text-black/20 hover:text-red-500 transition-colors"
                            aria-label="Remove item"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="w-full lg:w-1/3">
                <div className="bg-white p-8 border border-black/5 sticky top-12">
                  <h2 className="text-xl font-bold mb-6 pb-4 border-b border-black/10">Order Summary</h2>
                  
                  <div className="space-y-4 mb-8 font-medium">
                    <div className="flex justify-between">
                      <span className="text-black/60">Subtotal</span>
                      <span>{formatPrice(subtotalCents)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-black/60">Shipping</span>
                      <span>Free</span>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-black/10 mb-8 flex justify-between items-center">
                    <span className="text-lg font-bold uppercase tracking-widest">Total</span>
                    <span className="text-2xl font-bold">{formatPrice(subtotalCents)}</span>
                  </div>

                  <Button asChild className="w-full h-16 rounded-none bg-black hover:bg-[var(--theme-accent)] text-white text-[13px] uppercase tracking-widest font-bold transition-colors">
                    <Link href="/checkout">Proceed to Checkout</Link>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
