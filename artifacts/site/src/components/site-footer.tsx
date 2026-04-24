import { Link } from "wouter";
import { useGetContent } from "@workspace/api-client-react";

export function SiteFooter() {
  const { data: content } = useGetContent();

  return (
    <footer className="bg-[#FAF7F2] border-t border-black/5 py-16 text-center text-black/40 mt-auto">
      <p className="text-sm font-medium tracking-wide">{content?.footerNote || "© Store"}</p>
      <div className="mt-8">
        <Link href="/editor" className="text-[11px] uppercase tracking-widest font-bold hover:text-black transition-colors">
          Admin Area
        </Link>
      </div>
    </footer>
  );
}
