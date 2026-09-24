import { useGetContent } from "@workspace/api-client-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { useSchool } from "@/lib/school";

export default function BlogProgress() {
  const { school } = useSchool();
  const { data: content, isLoading, isError } = useGetContent({ school: school ?? "alvarado" });

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#F4EFE7]">Loading...</div>;
  }

  if (isError || !content) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4EFE7] px-6 text-center">
        <div className="max-w-lg">
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#657267]">Blog status</p>
          <h1 className="mt-4 text-3xl font-bold text-[#1E2621]">We couldn’t load this page.</h1>
          <p className="mt-3 text-[#526056]">Please refresh or try again later.</p>
        </div>
      </div>
    );
  }

  const paragraphs = content.blogBody.split(/\n\s*\n/).filter(Boolean);

  return (
    <div className="min-h-screen flex flex-col bg-[#F4EFE7] text-[#1E2621]" style={{ "--theme-accent": content.accentColor } as React.CSSProperties}>
      <SiteHeader />
      <main className="flex-1">
        <section className="max-w-6xl mx-auto px-6 pt-16 pb-20 md:pt-28 md:pb-28">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#657267]">From the writing desk</p>
            <h1 className="mt-6 font-serif text-5xl leading-[0.98] md:text-8xl">{content.blogTitle}</h1>
            <p className="mt-8 max-w-xl text-xl leading-relaxed text-[#526056]">{content.blogSubtitle}</p>
            <p className="mt-8 text-sm font-bold uppercase tracking-[0.18em] text-[#657267]">{content.blogDate}</p>
          </div>
          {content.blogHeroImageUrl && (
            <img src={content.blogHeroImageUrl} alt="" className="mt-16 aspect-[16/8] w-full object-cover" />
          )}
        </section>
        <section className="border-y border-[#1E2621]/10 bg-[#F9F6F0] px-6 py-20 md:py-28">
          <article className="prose prose-lg md:prose-xl mx-auto max-w-2xl prose-headings:font-serif prose-p:leading-relaxed prose-p:text-[#354239]">
            {paragraphs.map((paragraph, index) => <p key={`${index}-${paragraph.slice(0, 12)}`}>{paragraph}</p>)}
          </article>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}