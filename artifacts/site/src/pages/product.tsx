import { useState } from "react";
import { Link, useParams } from "wouter";
import { useGetContent, useGetProduct } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { formatPrice } from "@/lib/format";
import { useCart } from "@/lib/cart";
import { toast } from "sonner";
import { Minus, Plus } from "lucide-react";

export default function Product() {
  const { id } = useParams();
  const productId = parseInt(id || "0", 10);
  
  const { data: content } = useGetContent();
  const { data: product, isLoading, isError } = useGetProduct(productId);
  const { addItem } = useCart();
  
  const [quantity, setQuantity] = useState(1);

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#FAF7F2]">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-black border-t-transparent animate-spin"></div>
        </div>
      </div>
    );
  }

  if (isError || !product || !product.active || !product.showInShop) {
    return (
      <div className="min-h-screen w-full flex flex-col bg-[#FAF7F2]">
        <SiteHeader />
        <main className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">
          <h1 className="text-3xl font-bold mb-4">Product Not Found</h1>
          <p className="text-black/60 mb-8">This product doesn't exist or is no longer available.</p>
          <Button asChild className="rounded-full bg-black text-white px-8">
            <Link href="/shop">Back to Shop</Link>
          </Button>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const ordersEnabled = content?.ordersEnabled !== false;

  const handleAddToCart = () => {
    if (!ordersEnabled) return;
    addItem(productId, quantity);
    toast.success(`Added ${quantity} to cart`);
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

      <main className="flex-1 w-full px-6 py-12 md:py-24">
        <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row gap-12 md:gap-24 items-start">
          <div className="w-full md:w-1/2 bg-white aspect-[3/4] p-8 md:p-16 flex items-center justify-center border border-black/5 sticky top-12">
            <img 
              src={product.imageUrl || "https://placehold.co/800x1200?text=No+Image"} 
              alt={product.name}
              className="w-full h-full object-contain mix-blend-multiply"
            />
          </div>

          <div className="w-full md:w-1/2 flex flex-col pt-8 md:pt-16">
            <Link href="/shop" className="text-sm uppercase tracking-widest font-bold text-black/50 hover:text-black mb-8 transition-colors block">
              ← Back to Shop
            </Link>
            
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight mb-4">
              {product.name}
            </h1>
            
            <div className="text-2xl font-medium mb-12">
              {formatPrice(product.priceCents, product.currency)}
            </div>
            
            <div className="text-lg text-black/70 leading-relaxed mb-12 whitespace-pre-wrap font-medium">
              {product.description || "No description provided."}
            </div>

            {!ordersEnabled ? (
              <div className="mt-auto">
                <Button 
                  disabled
                  className="w-full h-14 rounded-none bg-black/10 text-black/40 font-bold uppercase tracking-widest text-sm"
                >
                  Not Available
                </Button>
              </div>
            ) : product.stock > 0 ? (
              <div className="flex flex-col sm:flex-row gap-4 mt-auto">
                <div className="flex items-center border border-black h-14 w-full sm:w-32 bg-white">
                  <button 
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-10 h-full flex items-center justify-center text-black/50 hover:text-black transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="flex-1 text-center font-bold text-lg">{quantity}</span>
                  <button 
                    onClick={() => setQuantity(quantity + 1)}
                    className="w-10 h-full flex items-center justify-center text-black/50 hover:text-black transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                
                <Button 
                  onClick={handleAddToCart}
                  className="flex-1 h-14 rounded-none bg-black hover:bg-[var(--theme-accent)] text-white font-bold uppercase tracking-widest text-sm transition-colors"
                >
                  Add to Cart
                </Button>
              </div>
            ) : (
              <div className="mt-auto">
                <Button 
                  disabled
                  className="w-full h-14 rounded-none bg-black/10 text-black/40 font-bold uppercase tracking-widest text-sm"
                >
                  Out of Stock
                </Button>
              </div>
            )}
            
            <div className="mt-8 pt-8 border-t border-black/10 flex gap-8 text-sm font-medium text-black/50">
              <p>Free shipping on all orders.</p>
              {ordersEnabled && <p>{product.stock} in stock.</p>}
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
