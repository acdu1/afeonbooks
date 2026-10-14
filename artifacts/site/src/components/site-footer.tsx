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
      <p>
        <a href="https://afeonbooks.com">The Terror Of The Evil Capybara</a> © 2026 by{" "}
        <a href="https://afeonbooks.com">AFEON Books</a> is licensed under{" "}
        <a href="https://creativecommons.org/licenses/by-nc-nd/4.0/">CC BY-NC-ND 4.0</a>
        {(["cc", "by", "nc", "nd"] as const).map((icon) => (
          <img
            key={icon}
            src={`https://mirrors.creativecommons.org/presskit/icons/${icon}.svg`}
            alt=""
            style={{ maxWidth: "1em", maxHeight: "1em", marginLeft: "0.2em" }}
          />
        ))}
      </p>
    </footer>
  );
}
