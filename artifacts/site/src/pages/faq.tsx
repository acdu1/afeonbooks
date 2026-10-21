import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { FaqSection } from "@/components/faq-section";

export default function Faq() {
  return (
    <div className="min-h-screen w-full flex flex-col bg-[#FAF7F2]">
      <SiteHeader />
      <main className="flex-1">
        <FaqSection />
      </main>
      <SiteFooter />
    </div>
  );
}