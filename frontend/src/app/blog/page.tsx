import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import BlogBanner from "@/components/blog/BlogBanner";
import BlogListView from "@/components/blog/BlogListView";
import { baseOpenGraph } from "@/lib/seo";
import { categoryHref } from "@/lib/blog";

type SearchParams = Promise<{ category?: string; tag?: string; q?: string; page?: string }>;

const DESCRIPTION =
  "Blog Lucy Tutor: chia sẻ kinh nghiệm luyện thi Tiếng Anh THPT Quốc Gia, IELTS, phương pháp học từ vựng, ngữ pháp và 4 kỹ năng.";

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const { tag, q, page } = await searchParams;
  const title = tag ? `#${tag} — Blog` : "Blog";
  return {
    title,
    description: DESCRIPTION,
    // Trang tìm kiếm / thẻ / phân trang không cần index riêng — tránh nội dung trùng lặp
    robots: q || tag || (page && page !== "1") ? { index: false, follow: true } : undefined,
    alternates: { canonical: "/blog" },
    openGraph: { ...baseOpenGraph, title: `${title} | Lucy Tutor`, description: DESCRIPTION, url: "/blog" },
  };
}

export default async function BlogPage({ searchParams }: { searchParams: SearchParams }) {
  const { category, tag = "", q = "", page = "1" } = await searchParams;
  // Link cũ dạng /blog?category=x -> trang danh mục riêng (tốt hơn cho SEO)
  if (category) permanentRedirect(categoryHref(category));

  return (
    <div className="flex-1">
      <BlogBanner
        crumbs={[{ label: "Blog" }]}
        title={tag ? `#${tag}` : "Blog Lucy Tutor"}
        subtitle="Kinh nghiệm luyện thi, phương pháp học Tiếng Anh và chia sẻ từ giáo viên Lucy Tutor."
        searchAction="/blog"
        defaultQuery={q}
        intro={!tag && !q ? <BlogIntro /> : undefined}
      />
      <BlogListView basePath="/blog" page={Math.max(1, parseInt(page) || 1)} q={q} tag={tag} />
    </div>
  );
}

const BLOG_TOPICS = [
  { title: "Luyện thi THPT Quốc Gia", text: "Chiến thuật làm từng dạng câu, cách phân bổ thời gian và lỗi hay gặp." },
  { title: "IELTS 4 kỹ năng", text: "Cách tiếp cận Listening, Reading, Writing, Speaking theo tiêu chí chấm band." },
  { title: "Từ vựng & ngữ pháp", text: "Học từ theo ngữ cảnh, phrasal verb, chủ điểm ngữ pháp trọng tâm." },
  { title: "Phương pháp tự học", text: "Lập kế hoạch, ôn tập ngắt quãng và duy trì thói quen học mỗi ngày." },
];

// Đoạn dẫn nhập trang /blog: nói rõ blog để làm gì + có những chủ đề nào, dẫn người đọc xuống danh sách bài.
function BlogIntro() {
  return (
    <div className="mt-5 max-w-2xl">
      <p className="border-l-4 border-primary pl-4 text-sm md:text-base text-foreground leading-relaxed">
        Học Tiếng Anh hiệu quả không nằm ở số giờ ngồi học mà ở <strong className="text-primary">cách học đúng</strong>.
        Đây là nơi giáo viên Lucy Tutor ghi lại những gì đúc kết từ quá trình đứng lớp: mẹo làm bài, lỗi sai hay gặp
        và cách khắc phục, viết ngắn gọn, có ví dụ để bạn áp dụng ngay.
      </p>

      <p className="mt-5 mb-2.5 text-xs font-bold uppercase tracking-wider text-muted">Bạn sẽ tìm thấy gì ở đây</p>
      <ul className="grid sm:grid-cols-2 gap-3">
        {BLOG_TOPICS.map((t, i) => (
          <li key={t.title} className="flex gap-3 rounded-xl border border-line bg-surface p-3.5 shadow-card">
            <span
              aria-hidden
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-xs font-bold text-primary"
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-primary">{t.title}</span>
              <span className="mt-0.5 block text-xs leading-snug text-muted">{t.text}</span>
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-primary">
        <span aria-hidden>↓</span> Chọn chủ đề bên dưới hoặc tìm theo từ khoá để bắt đầu đọc
      </p>
    </div>
  );
}
