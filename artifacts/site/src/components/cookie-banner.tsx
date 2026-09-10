import { useEffect, useState } from "react";
import { Cookie, X } from "lucide-react";

const CONSENT_KEY = "afeonbooks_cookie_consent";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(localStorage.getItem(CONSENT_KEY) === null);
  }, []);

  const saveConsent = (value: "accepted" | "declined") => {
    localStorage.setItem(CONSENT_KEY, value);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <aside
      className="fixed inset-x-4 bottom-4 z-[100] border border-black/10 bg-white p-5 shadow-xl sm:inset-x-auto sm:left-6 sm:max-w-lg"
      role="dialog"
      aria-label="Cookie preferences"
    >
      <div className="flex items-start gap-4">
        <Cookie className="mt-0.5 h-5 w-5 shrink-0 text-black/60" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-black">Cookies on AFEON Books</h2>
          <p className="mt-2 text-sm leading-relaxed text-black/60">
            We use essential cookies to keep accounts signed in and remember your preferences. You can decline optional cookies.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => saveConsent("accepted")}
              className="bg-black px-4 py-2 text-xs font-bold uppercase tracking-widest text-white hover:bg-black/80"
            >
              Accept
            </button>
            <button
              type="button"
              onClick={() => saveConsent("declined")}
              className="border border-black/20 px-4 py-2 text-xs font-bold uppercase tracking-widest text-black hover:border-black"
            >
              Decline
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => saveConsent("declined")}
          aria-label="Close cookie notice"
          className="shrink-0 text-black/40 hover:text-black"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}