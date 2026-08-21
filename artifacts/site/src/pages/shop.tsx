import { Link } from "wouter";
import { useGetContent, useListProducts } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { formatPrice } from "@/lib/format";
import { useCart } from "@/lib/cart";
import { toast } from "sonner";
import { useSchool } from "@/lib/school";

export default function Shop() {
  const { school } = useSchool();
  const { data: content } = useGetContent({ school: school ?? "alvarado" });
  const { data: products, isLoading } = useListProducts({ school: school ?? "alvarado" });
  const { addItem } = useCart();

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#FAF7F2]">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-black border-t-transparent animate-spin"></div>
        </div>
      </div>
    );
  }

  const ordersEnabled = content?.ordersEnabled !== false;
  const activeProducts = products?.filter((p) => p.active) || [];

  const handleAddToCart = (productId: number) => {
    if (!ordersEnabled) return;
    addItem(productId);
    toast.success("Added to cart");
  };

  return (
    <div 
      className="min-h-screen w-full flex flex-col font-sans bg-[#FAF7F2]"
      style={{ "--theme-accent": content?.accentColor || "#000" } as React.CSSProperties}
    >
      <SiteHeader />

      {!ordersEnabled && (
        <div className="w-full bg-amber-50 border-b border-amber-200 px-6 py-4 text-center">
          <p className="text-amber-800 font-semibold text-sm uppercase tracking-widest">
            We are not accepting orders at this time. Check back soon!
          </p>
        </div>
      )}

      <main className="flex-1 w-full px-6 py-20">
        <div className="max-w-[1400px] mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-black mb-16 text-center">
            All Products
          </h1>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
            {activeProducts.map((product) => (
              <div key={product.id} className="flex flex-col group">
                <Link href={`/product/${product.id}`} className="block aspect-[3/4] bg-white mb-6 overflow-hidden relative p-8 flex items-center justify-center border border-black/5 hover:border-black/20 transition-colors">
                  <img 
                    src={product.imageUrl || "https://placehold.co/400x600?text=No+Image"} 
                    alt={product.name}
                    className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
                  />
                </Link>
                <div className="flex flex-col flex-1">
                  <Link href={`/product/${product.id}`} className="text-lg font-bold text-black mb-1 hover:text-[var(--theme-accent)] transition-colors">
                    {product.name}
                  </Link>
                  <p className="text-black/60 mb-6">{formatPrice(product.priceCents, product.currency)}</p>
                  <div className="mt-auto">
                    <Button 
                      onClick={() => handleAddToCart(product.id)}
                      className="w-full rounded-none bg-black hover:bg-[var(--theme-accent)] text-white py-6 font-bold uppercase tracking-widest text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      disabled={product.stock <= 0 || !ordersEnabled}
                    >
                      {!ordersEnabled ? "Unavailable" : product.stock > 0 ? "Add to Cart" : "Out of Stock"}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {activeProducts.length === 0 && (
            <div className="text-center py-20">
              <p className="text-black/50 text-xl mb-8">No products available right now.</p>
              <Button asChild className="rounded-full px-8 bg-black hover:bg-[var(--theme-accent)] text-white">
                <Link href="/">Back to Home</Link>
              </Button>
            </div>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
