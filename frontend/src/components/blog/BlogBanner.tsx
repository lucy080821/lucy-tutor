import Link from "next/link";

// Banner đầu trang blog kiểu IOT: breadcrumb → H1 → mô tả → ô tìm kiếm, minh hoạ bên phải trên desktop.
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
  return (
    <section className="bg-primary-soft">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 md:py-10 flex items-center gap-8">
        <div className="flex-1 min-w-0">
          <nav aria-label="Breadcrumb" className="text-xs text-muted mb-2">
            <Link href="/" className="hover:text-primary">Trang chủ</Link>
            {crumbs.map((c) => (
              <span key={c.label}>
                {" / "}
                {c.href ? <Link href={c.href} className="hover:text-primary">{c.label}</Link> : <span>{c.label}</span>}
              </span>
            ))}
          </nav>
          <h1 className="ui-page-title">{title}</h1>
          {subtitle && <p className="ui-page-subtitle mt-2">{subtitle}</p>}
          {intro}
          {searchAction && (
            <form action={searchAction} className="mt-5 flex gap-2 max-w-md">
              <input
                type="search"
                name="q"
                defaultValue={defaultQuery}
                placeholder="Tìm bài viết..."
                aria-label="Tìm bài viết"
                className="ui-input flex-1 min-w-0"
              />
              <button type="submit" className="btn-primary shrink-0">Tìm</button>
            </form>
          )}
        </div>
        {aside ?? (
          <img
            src="/images/illustrations/study-progress.svg"
            alt="Minh hoạ học tập"
            width={280}
            height={210}
            className="hidden md:block w-56 lg:w-64 h-auto shrink-0"
          />
        )}
      </div>
    </section>
  );
}
