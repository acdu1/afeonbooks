import { useRef } from "react";
import { Link, useLocation } from "wouter";
import { ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/cart";
import { createAuthEntryUrl, useAuth } from "@/lib/auth";
import xlogo from "@assets/logo_web.png";

interface SiteHeaderProps {
  simple?: boolean;
}

const SECRET_TAPS = 5;
const TAP_WINDOW_MS = 800;

export function SiteHeader({ simple = false }: SiteHeaderProps) {
  const { itemCount, openCart } = useCart();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const tapCountRef = useRef(0);
  const lastTapAtRef = useRef(0);

  const handleLogoClick = () => {
    const now = Date.now();
    if (now - lastTapAtRef.current > TAP_WINDOW_MS) {
      tapCountRef.current = 0;
    }
    lastTapAtRef.current = now;
    tapCountRef.current += 1;

    if (tapCountRef.current >= SECRET_TAPS) {
      tapCountRef.current = 0;
      window.location.assign("/admin/");
      return;
    }
    setLocation("/");
  };

  return (
    <header className="px-6 py-8">
      <div className="max-w-[1400px] mx-auto flex items-center justify-between">
        <button
          type="button"
          onClick={handleLogoClick}
          aria-label="Home"
          className="h-10 flex items-center justify-center cursor-pointer hover:opacity-100 transition-opacity focus:outline-none"
        >
          <img src={xlogo} alt="" className="w-full h-full object-contain" draggable={false} />
        </button>
        <nav className="flex items-center gap-8 text-black">
          {!simple ? (
            <>
              <Link href="/" className="text-[15px] font-medium tracking-wide hover:opacity-70 transition-opacity">
                Home
              </Link>
              <Link href="/shop" className="text-[15px] font-medium tracking-wide hover:opacity-70 transition-opacity">
                Shop
              </Link>
              <a href={createAuthEntryUrl(Boolean(user))} className="text-[15px] font-medium tracking-wide hover:opacity-70 transition-opacity">
                {user ? "Account" : "Sign in"}
              </a>
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
            <a href="https://afeonbooks.com/" className="text-[15px] font-medium tracking-wide hover:opacity-70 transition-opacity">
              View Site
            </a>
          )}
        </nav>
      </div>
    </header>
  );
}
