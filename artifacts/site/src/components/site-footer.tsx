import { useGetContent } from "@workspace/api-client-react";

export function SiteFooter() {
  const { data: content } = useGetContent();

  return (
    <footer className="bg-[#FAF7F2] border-t border-black/5 py-16 text-center text-black/40 mt-auto">
      {/* Footer Content Note */}
      <p className="text-sm font-medium tracking-wide">
        {content?.footerNote || "© Store"}
      </p>

      {/* Creative Commons Licensing Notice */}
      <div className="flex items-center justify-center flex-wrap gap-x-1 mt-4 text-xs font-normal text-black/40">
        <a 
          href="https://afeonbooks.com" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="hover:underline text-black/50"
        >
          The Terror Of The Evil Capybara
        </a>
        <span>© 2026 by</span>
        <a 
          href="https://afeonbooks.com" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="hover:underline text-black/50"
        >
          AFEON Books
        </a>
        <span>is licensed under</span>
        <a 
          href="https://creativecommons.org" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="hover:underline text-black/50"
        >
          CC BY-NC-ND 4.0
        </a>
        
        {/* Licensing Badges */}
        <div className="inline-flex items-center gap-0.5 ml-1 opacity-60">
          <img 
            src="https://creativecommons.org" 
            alt="CC Badge" 
            className="w-4 h-4" 
          />
          <img 
            src="https://creativecommons.org" 
            alt="Attribution Badge" 
            className="w-4 h-4" 
          />
          <img 
            src="https://creativecommons.org" 
            alt="Non-Commercial Badge" 
            className="w-4 h-4" 
          />
          <img 
            src="https://creativecommons.org" 
            alt="No-Derivatives Badge" 
            className="w-4 h-4" 
          />
        </div>
      </div>

      {/* System Status Link */}
      <a
        href="https://status.afeonbooks.com/"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block mt-4 text-xs font-bold uppercase tracking-widest text-black/35 hover:text-amber-800 transition-colors"
      >
        System Status ↗
      </a>
    </footer>
  );
}
