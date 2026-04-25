import { Link } from "wouter";
import { ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/cart";

interface SiteHeaderProps {
  simple?: boolean;
}

export function SiteHeader({ simple = false }: SiteHeaderProps) {
  const { itemCount, openCart } = useCart();

  return (
    <header className="px-6 py-8">
      <div className="max-w-[1400px] mx-auto flex items-center justify-between">
        <Link href="/">
          <div className="w-9 h-9 bg-black rounded-full cursor-pointer hover:opacity-80 transition-opacity" aria-label="Home"></div>
        </Link>
        <nav className="flex items-center gap-8 text-black">
          {!simple ? (
            <>
              <Link href="/" className="text-[15px] font-medium tracking-wide hover:opacity-70 transition-opacity">
                Home
              </Link>
              <Link href="/shop" className="text-[15px] font-medium tracking-wide hover:opacity-70 transition-opacity">
                Shop
              </Link>
              <button
                type="button"
                onClick={openCart}
                aria-label="Open cart"
                className="relative cursor-pointer hover:opacity-70 transition-opacity flex items-center"
              >
                <ShoppingBag className="w-5 h-5 stroke-[1.5]" />
                {itemCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-[var(--theme-accent,black)] text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full">
                    {itemCount}
                  </span>
                )}
              </button>
            </>
          ) : (
            <Link href="/" className="text-[15px] font-medium tracking-wide hover:opacity-70 transition-opacity">
              View Site
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
