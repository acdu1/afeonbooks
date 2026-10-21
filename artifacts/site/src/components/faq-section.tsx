import { Link } from "wouter";
import { useGetContent } from "@workspace/api-client-react";

interface FaqSectionProps {
  showAllLink?: boolean;
}

export function FaqSection({ showAllLink = false }: FaqSectionProps) {
  const { data: content, isLoading, isError } = useGetContent();

  return (
    <section className="px-6 py-24 bg-white" aria-labelledby="faq-heading">
      <div className="max-w-3xl mx-auto">
        <h2 id="faq-heading" className="text-3xl md:text-4xl font-bold tracking-tight text-black mb-10 text-center">
          Frequently Asked Questions
        </h2>
        <div className="border-t border-black/10">
          {isLoading ? (
            <p className="py-6 text-center text-sm text-black/50">Loading FAQs...</p>
          ) : isError ? (
            <p className="py-6 text-center text-sm text-black/50">FAQs are temporarily unavailable.</p>
          ) : (content?.faqs ?? []).map(({ question, answer }) => (
              <details key={question} className="group border-b border-black/10 py-5">
                <summary className="cursor-pointer list-none pr-8 text-base md:text-lg font-semibold text-black marker:hidden">
                  {question}
                  <span aria-hidden="true" className="float-right text-black/50 group-open:rotate-45 transition-transform">+</span>
                </summary>
                <p className="mt-4 max-w-2xl text-sm md:text-base leading-relaxed text-black/65">{answer}</p>
              </details>
            ))}
        </div>
        {showAllLink && (
          <div className="mt-8 text-center">
            <Link href="/faq" className="text-sm font-bold uppercase tracking-widest text-black hover:text-[var(--theme-accent)] transition-colors">
              View all FAQs
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}