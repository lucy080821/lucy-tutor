import Link from "next/link";
import { PHOTOS } from "@/lib/photos";

// Banner đầu trang blog: breadcrumb → H1 → mô tả → ô tìm kiếm. Bên phải: ảnh người (tách nền) cỡ lớn đứng trên
// vòng tròn navy + 2 thẻ nổi (cùng phong cách ToolBanner của trang công cụ); trên mobile ảnh xếp dưới chữ.
// Trang truyền `aside` riêng (vd trang tác giả hiện avatar) thì dùng bố cục gọn cũ.
export default function BlogBanner({
  crumbs,
  title,
  subtitle,
  searchAction,
  defaultQuery = "",
  intro,
  aside,
}: {
  crumbs: { label: string; href?: string }[];
  title: string;
  subtitle?: string | null;
  searchAction?: string;
  defaultQuery?: string;
  intro?: React.ReactNode;
  aside?: React.ReactNode;
}) {
  const text = (
    <>
      <nav aria-label="Breadcrumb" className="text-xs text-muted mb-2">
        <Link href="/" className="hover:text-primary">Trang chủ</Link>
        {crumbs.map((c) => (
          <span key={c.label}>
            {" / "}
            {c.href ? <Link href={c.href} className="hover:text-primary">{c.label}</Link> : <span>{c.label}</span>}
          </span>
        ))}
      </nav>
      <h1 className={aside ? "ui-page-title" : "text-3xl sm:text-4xl lg:text-[2.6rem] font-extrabold tracking-tight leading-tight text-primary"}>{title}</h1>
      {subtitle && <p className={aside ? "ui-page-subtitle mt-2" : "mt-3 text-base sm:text-lg text-muted leading-relaxed max-w-xl"}>{subtitle}</p>}
      {intro}
      {searchAction && (
        <form action={searchAction} className="mt-5 flex gap-2 max-w-md">
          <input
            type="search"
            name="q"
            defaultValue={defaultQuery}
            placeholder="Tìm bài viết..."
            aria-label="Tìm bài viết"
            className="ui-input flex-1 min-w-0 bg-white"
          />
          <button type="submit" className="btn-primary shrink-0">Tìm</button>
        </form>
      )}
    </>
  );

  if (aside) {
    return (
      <section className="bg-primary-soft">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 md:py-10 flex items-center gap-8">
          <div className="flex-1 min-w-0">{text}</div>
          {aside}
        </div>
      </section>
    );
  }

  const photo = PHOTOS.blog;
  return (
    <section className="relative overflow-hidden bg-primary-soft">
      <span aria-hidden="true" className="pointer-events-none absolute -top-24 -left-24 w-72 h-72 rounded-full bg-white/60" />
      <div className="relative max-w-6xl mx-auto px-4 md:px-8 pt-8 md:pt-10 grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-4 md:gap-8 items-end">
        <div className="min-w-0 pb-2 md:pb-14">{text}</div>
        {/* Trang /blog có khối giới thiệu dài → ẩn ảnh trên mobile để danh sách bài không bị đẩy quá xa */}
        <div className={`relative h-[280px] sm:h-[340px] md:h-[400px] ${intro ? "hidden md:block" : ""}`}>
          <span aria-hidden="true" className="absolute inset-x-0 -bottom-24 flex justify-center">
            <span className="block w-[280px] h-[280px] sm:w-[340px] sm:h-[340px] md:w-[400px] md:h-[400px] rounded-full bg-primary" />
          </span>
          <span aria-hidden="true" className="lp-blob absolute right-[10%] top-[8%] w-14 h-14 rounded-full bg-highlight/70" />
          <span aria-hidden="true" className="absolute left-[8%] top-[24%] w-20 h-20 rounded-full border-[9px] border-white/70" />
          <img src={photo.src} alt={photo.alt} width={photo.width} height={photo.height} loading="eager" fetchPriority="high"
            className="relative h-full w-full object-contain object-bottom drop-shadow-[0_18px_30px_rgba(30,58,138,0.25)]" />
          <div className="lp-pop-float absolute left-0 top-6 bg-white rounded-2xl shadow-card border border-line px-4 py-2.5 max-w-[190px]">
            <p className="text-sm font-bold text-primary leading-snug">Mẹo luyện thi THPT & IELTS</p>
          </div>
          <div className="lp-pop-float absolute right-0 bottom-10 bg-white rounded-2xl shadow-card border border-line px-4 py-2.5 max-w-[200px]">
            <p className="text-sm font-bold text-primary leading-snug">Nghe bài viết bằng giọng đọc AI</p>
          </div>
        </div>
      </div>
    </section>
  );
}
