import { useGetContent } from "@workspace/api-client-react";

export function SiteFooter() {
  const { data: content } = useGetContent();

  return (
    <footer className="bg-[#FAF7F2] border-t border-black/5 py-16 text-center text-black/40 mt-auto">
      <p className="text-sm font-medium tracking-wide">{content?.footerNote || "© Store"}</p>
      <a
        href="https://status.afeonbooks.com/"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block mt-3 text-xs font-bold uppercase tracking-widest text-black/35 hover:text-amber-800 transition-colors"
      >
        System Status ↗
      </a>
    </footer>
  );
}
