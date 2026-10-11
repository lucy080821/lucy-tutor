import type { CSSProperties } from "react";
import Link from "next/link";
import { SITE_URL, SITE_NAME } from "@/lib/seo";
import { FREE_TOOLS } from "@/lib/freeTools";
import type { Photo } from "@/lib/photos";

// Khung dùng chung cho các trang công cụ miễn phí (không cần đăng nhập). Server component để
// nội dung (H1, mô tả, FAQ, JSON-LD) nằm sẵn trong HTML cho Google đọc; phần tương tác là client
// component con do từng trang tự gắn.

export type Faq = { q: string; a: string };
export type Crumb = { name: string; href: string };

const d = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

/** Banner đầu trang kiểu landing page: tiêu đề lớn bên trái, ảnh người (tách nền) cỡ lớn bên phải đứng trên
 *  vòng tròn navy + 2 thẻ nổi nêu điểm chính. Trên mobile ảnh xếp dưới chữ. Hiệu ứng vào trang dùng lại class
 *  lp-* của trang chủ (CSS thuần, tự tắt khi người dùng bật "giảm chuyển động"). */
export function ToolBanner({ crumbs, title, subtitle, photo, highlights, cta = "Dùng ngay miễn phí" }: {
  crumbs: Crumb[]; title: string; subtitle: string; photo: Photo; highlights: [string, string]; cta?: string;
}) {
  return (
    <section className="relative overflow-hidden bg-primary-soft border-b border-line">
      <span aria-hidden="true" className="pointer-events-none absolute -top-24 -left-24 w-72 h-72 rounded-full bg-white/60" />
      <div className="relative max-w-6xl mx-auto px-4 pt-6 sm:pt-10 grid grid-cols-1 md:grid-cols-[1.15fr_1fr] gap-4 md:gap-8 items-end">
        <div className="pb-2 md:pb-16 min-w-0">
          <nav aria-label="Breadcrumb" className="text-sm text-muted">
            <ol className="flex flex-wrap items-center gap-1">
              <li><Link href="/" className="hover:text-primary">Trang chủ</Link></li>
              {crumbs.map((c, i) => (
                <li key={c.href} className="flex items-center gap-1">
                  <span aria-hidden="true">/</span>
                  {i === crumbs.length - 1
                    ? <span aria-current="page" className="text-foreground">{c.name}</span>
                    : <Link href={c.href} className="hover:text-primary">{c.name}</Link>}
                </li>
              ))}
            </ol>
          </nav>
          <p className="lp-enter mt-5 flex flex-wrap gap-2" style={d(0)}>
            <span className="ui-badge-new">Miễn phí</span>
            <span className="ui-badge bg-white">Không cần đăng nhập</span>
          </p>
          <h1 className="lp-enter mt-3 text-3xl sm:text-4xl lg:text-[2.75rem] font-extrabold tracking-tight leading-tight text-primary" style={d(100)}>{title}</h1>
          <p className="lp-enter mt-4 text-base sm:text-lg text-muted leading-relaxed max-w-xl" style={d(200)}>{subtitle}</p>
          <a href="#bat-dau" className="lp-enter btn-primary lp-shine mt-6 px-7 py-3.5 text-base" style={d(300)}>{cta}</a>
        </div>

        <div className="relative h-[300px] sm:h-[360px] md:h-[440px]">
          {/* Vòng tròn navy + đốm cam phía sau người trong ảnh */}
          <span aria-hidden="true" className="absolute inset-x-0 -bottom-24 flex justify-center">
            <span className="lp-enter-zoom block w-[300px] h-[300px] sm:w-[360px] sm:h-[360px] md:w-[440px] md:h-[440px] rounded-full bg-primary" style={d(100)} />
          </span>
          <span aria-hidden="true" className="lp-blob absolute right-[8%] top-[10%] w-16 h-16 rounded-full bg-highlight/70" />
          <span aria-hidden="true" className="absolute left-[6%] top-[22%] w-24 h-24 rounded-full border-[10px] border-white/70" />
          <img src={photo.src} alt={photo.alt} width={photo.width} height={photo.height} loading="eager" fetchPriority="high"
            className="lp-enter relative h-full w-full object-contain object-bottom drop-shadow-[0_18px_30px_rgba(30,58,138,0.25)]" style={d(200)} />
          <div className="lp-pop-float absolute left-0 sm:left-2 top-6 bg-white rounded-2xl shadow-card border border-line px-4 py-2.5 max-w-[180px]" style={d(500)}>
            <p className="text-sm font-bold text-primary leading-snug">{highlights[0]}</p>
          </div>
          <div className="lp-pop-float absolute right-0 sm:right-2 bottom-10 bg-white rounded-2xl shadow-card border border-line px-4 py-2.5 max-w-[190px]" style={d(700)}>
            <p className="text-sm font-bold text-primary leading-snug">{highlights[1]}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/** JSON-LD: WebApplication (công cụ) + BreadcrumbList + FAQPage. Chỉ thông tin có thật — không rating/review. */
export function ToolJsonLd({ name, path, description, crumbs, faqs, category = "EducationalApplication", image }: {
  name: string; path: string; description: string; crumbs: Crumb[]; faqs?: Faq[]; category?: string; image?: Photo;
}) {
  const url = `${SITE_URL}${path}`;
  const graph: Record<string, unknown>[] = [
    {
      "@type": "WebApplication",
      name,
      url,
      description,
      applicationCategory: category,
      ...(image ? { image: `${SITE_URL}${image.src}` } : {}),
      operatingSystem: "Web",
      inLanguage: "vi-VN",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "VND" },
      provider: { "@type": "EducationalOrganization", name: SITE_NAME, url: SITE_URL },
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [{ name: "Trang chủ", href: "" }, ...crumbs].map((c, i) => ({
        "@type": "ListItem", position: i + 1, name: c.name, item: `${SITE_URL}${c.href}`,
      })),
    },
  ];
  if (faqs?.length) {
    graph.push({
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    });
  }
  return (
    <script type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(/</g, "\\u003c") }} />
  );
}

export function ToolFaq({ faqs, title = "Câu hỏi thường gặp" }: { faqs: Faq[]; title?: string }) {
  return (
    <section aria-labelledby="tool-faq" className="mt-12">
      <h2 id="tool-faq" className="ui-section-title text-xl mb-5">{title}</h2>
      <div className="space-y-3">
        {faqs.map((f, i) => (
          <details key={f.q} className="group ui-card px-5 py-1" open={i === 0}>
            <summary className="flex items-center justify-between gap-4 py-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              <h3 className="font-bold text-primary text-base">{f.q}</h3>
              <svg aria-hidden="true" className="w-5 h-5 shrink-0 text-primary transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </summary>
            <p className="pb-4 text-sm sm:text-base text-muted leading-relaxed">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

/** Lời mời dùng thử — chỉ nêu ưu đãi có thật (dùng thử 3 ngày). */
export function ToolCta({ text }: { text: string }) {
  return (
    <section className="mt-12 ui-card p-6 sm:p-8 flex flex-col md:flex-row md:items-center gap-5 justify-between">
      <div>
        <h2 className="text-xl font-bold text-primary">Muốn luyện tiếp có lộ trình?</h2>
        <p className="text-muted mt-1">{text}</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 shrink-0">
        <Link href="/auth?role=STUDENT" className="btn-primary px-6 py-3 text-center">Dùng thử miễn phí 3 ngày</Link>
      </div>
    </section>
  );
}

export function RelatedTools({ current }: { current: string }) {
  const tools = FREE_TOOLS.filter((t) => t.href !== current);
  return (
    <section aria-labelledby="related-tools" className="mt-12">
      <h2 id="related-tools" className="ui-section-title text-xl mb-5">Công cụ miễn phí khác</h2>
      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tools.map((t) => (
          <li key={t.href}>
            <Link href={t.href} className="ui-card ui-card-hover p-4 flex items-start gap-3 h-full">
              <img src={t.thumb} alt="" width={640} height={360} loading="lazy" className="w-20 h-auto rounded-lg border border-line shrink-0" />
              <span className="min-w-0">
                <span className="block font-bold text-primary text-sm leading-snug">{t.title}</span>
                <span className="block text-xs text-muted mt-1 line-clamp-2">{t.desc}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

