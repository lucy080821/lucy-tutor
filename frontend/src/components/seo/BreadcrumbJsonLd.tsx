import { SITE_URL } from "@/lib/seo";

// JSON-LD BreadcrumbList cho trang không dùng khung công cụ (ToolJsonLd đã có sẵn breadcrumb).
// `items` không gồm "Trang chủ" — tự thêm ở đầu. `href` là đường dẫn tương đối ("/blog").
export default function BreadcrumbJsonLd({ items }: { items: { name: string; href: string }[] }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [{ name: "Trang chủ", href: "" }, ...items].map((c, i) => ({
      "@type": "ListItem", position: i + 1, name: c.name, item: `${SITE_URL}${c.href}`,
    })),
  };
  return (
    <script type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\u003c") }} />
  );
}
