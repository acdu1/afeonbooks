import { useGetContent } from "@workspace/api-client-react";
import { useSchool } from "@/lib/school";

export function SiteFooter() {
  const { school } = useSchool();
  const { data: content } = useGetContent({ school: school ?? "alvarado" });

  return (
    <footer className="bg-[#FAF7F2] border-t border-black/5 py-16 text-center text-black/40 mt-auto">
      <p className="text-sm font-medium tracking-wide">{content?.footerNote || "© Store"}</p>
    </footer>
  );
}
