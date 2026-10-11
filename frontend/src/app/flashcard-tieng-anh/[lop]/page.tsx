import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { pageMetadata } from "@/lib/seo";
import { ToolBanner, ToolJsonLd, ToolFaq, ToolCta, RelatedTools, type Faq } from "@/components/tools/ToolPage";
import FlashcardViewer from "@/components/tools/FlashcardViewer";
import { GRADE_NUMBERS, UPDATING_TEXT, getFlashGrade, gradeSlug, gradeWordCount, readyUnits } from "@/lib/tools/flashcards";
import { PHOTOS } from "@/lib/photos";

// Từ khoá chính mỗi trang: "flashcard tiếng anh lớp N global success"
// Từ khoá phụ: flashcard tiếng anh lớp N global success pdf, từ vựng tiếng anh lớp N, từ vựng tiếng anh lớp N theo unit
type Params = Promise<{ lop: string }>;
const HUB = "/flashcard-tieng-anh";

// 12 trang lớp dựng sẵn lúc build, làm mới mỗi giờ theo từ vựng trong hệ thống; đường dẫn khác → 404
export const dynamicParams = false;
export function generateStaticParams() {
  return GRADE_NUMBERS.map((g) => ({ lop: gradeSlug(g) }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lop } = await params;
  const g = await getFlashGrade(lop);
  if (!g) return {};
  const words = gradeWordCount(g);
  const meta = pageMetadata({
    title: `Flashcard Tiếng Anh Lớp ${g.grade} Global Success (PDF) – Từ Vựng Theo Unit`,
    description: words
      ? `Flashcard tiếng Anh lớp ${g.grade} Global Success: ${words} thẻ từ vựng theo Unit, có phiên âm và câu ví dụ, lật thẻ online, nghe phát âm và tải PDF miễn phí để in.`
      : `Flashcard tiếng Anh lớp ${g.grade} Global Success theo từng Unit — từ vựng đang được cập nhật.`,
    path: `${HUB}/${g.slug}`,
    image: PHOTOS.flashcard,
    keywords: [
      `flashcard tiếng anh lớp ${g.grade}`, `flashcard tiếng anh lớp ${g.grade} global success`,
      `flashcard tiếng anh ${g.grade} global success pdf`, `từ vựng tiếng anh lớp ${g.grade}`,
      `từ vựng tiếng anh lớp ${g.grade} theo unit`, `từ vựng tiếng anh ${g.grade} global success`,
    ],
  });
  // Lớp chưa có từ nào → chưa cho Google index (trang gần như trống)
  return words ? meta : { ...meta, robots: { index: false, follow: true } };
}

export default async function Page({ params }: { params: Params }) {
  const { lop } = await params;
  const g = await getFlashGrade(lop);
  if (!g) notFound();

  const words = gradeWordCount(g);
  const ready = readyUnits(g);
  const path = `${HUB}/${g.slug}`;
  const crumbs = [{ name: "Flashcard tiếng Anh", href: HUB }, { name: `Lớp ${g.grade}`, href: path }];
  const title = `Flashcard Tiếng Anh Lớp ${g.grade} Global Success`;
  const description = words
    ? `${words} thẻ từ vựng tiếng Anh lớp ${g.grade} theo ${ready.length} Unit sách Global Success, tải PDF miễn phí.`
    : `Flashcard tiếng Anh lớp ${g.grade} Global Success theo Unit — ${UPDATING_TEXT}`;
  const faqs: Faq[] = [
    {
      q: `Flashcard tiếng Anh lớp ${g.grade} đã có những Unit nào?`,
      a: ready.length
        ? `Hiện đã có ${ready.length}/${g.units.length} Unit: ${ready.map((u) => `${u.label} ${u.title}`).join("; ")}. Các Unit còn lại đang được cập nhật.`
        : `Từ vựng lớp ${g.grade} đang được cập nhật. Hệ thống tự kiểm tra mỗi ngày và bổ sung ngay khi có Unit mới.`,
    },
    { q: "Có tải PDF từng Unit được không?", a: "Có. Chọn Unit rồi bấm \"Tải PDF\" để tải riêng Unit đó, hoặc bấm \"Tải PDF cả lớp\" để tải toàn bộ các Unit đã có. Mỗi trang A4 có 12 thẻ kiểu gấp đôi." },
    { q: "Từ vựng lấy từ đâu?", a: "Từ vựng do giáo viên Lucy Tutor soạn cho từng Unit sách Global Success trong bài học trên lớp, kèm phiên âm và câu ví dụ. Hệ thống tự kiểm tra mỗi cuối ngày và cập nhật thêm Unit mới." },
  ];

  return (
    <div className="min-h-screen bg-background">
      <ToolJsonLd name={title} path={path} description={description} crumbs={crumbs} faqs={faqs} image={PHOTOS.flashcard} />
      <ToolBanner crumbs={crumbs} title={title}
        subtitle={words ? `${words} thẻ từ vựng theo Unit — lật thẻ, nghe phát âm và tải PDF để in.` : UPDATING_TEXT}
        photo={PHOTOS.flashcard} highlights={[words ? `${ready.length}/${g.units.length} Unit · ${words} thẻ` : UPDATING_TEXT, "Tải PDF miễn phí"]} cta="Học flashcard ngay" />

      <div id="bat-dau" className="max-w-5xl mx-auto px-4 py-6 sm:py-8 scroll-mt-16">
        <nav aria-label="Chọn lớp khác" className="flex flex-wrap gap-2 mb-6">
          {GRADE_NUMBERS.map((n) => (
            <Link key={n} href={`${HUB}/${gradeSlug(n)}`} className={`ui-chip ${n === g.grade ? "ui-chip-active" : ""}`} aria-current={n === g.grade ? "page" : undefined}>
              Lớp {n}
            </Link>
          ))}
        </nav>

        <FlashcardViewer data={g} />

        {/* Danh sách từ đầy đủ theo Unit — render sẵn trong HTML để tìm kiếm/đọc được cả khi không bật JS */}
        <section className="mt-12" aria-labelledby="word-list">
          <h2 id="word-list" className="ui-section-title text-xl mb-5">Từ vựng tiếng Anh lớp {g.grade} theo Unit</h2>
          <div className="space-y-3">
            {g.units.map((u) => (
              <details key={u.label} className="group ui-card px-5 py-1" open={u === ready[0]}>
                <summary className="flex items-center justify-between gap-4 py-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                  <h3 className="font-bold text-primary text-base">{u.label}: {u.title}</h3>
                  <span className="text-sm text-muted shrink-0">{u.cards.length ? `${u.cards.length} từ` : UPDATING_TEXT}</span>
                </summary>
                {u.cards.length ? (
                  <div className="overflow-x-auto pb-4">
                    <table className="ui-table w-full text-sm">
                      <thead><tr><th>Từ vựng</th><th>Phiên âm</th><th>Nghĩa</th></tr></thead>
                      <tbody>
                        {u.cards.map((c) => (
                          <tr key={c.en}>
                            <td><b>{c.en}</b>{c.pos && <span className="text-muted"> ({c.pos})</span>}</td>
                            <td className="text-muted whitespace-nowrap">{c.phonetic ?? ""}</td>
                            <td>{c.vi}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="pb-4 text-sm text-muted">{UPDATING_TEXT}</p>
                )}
              </details>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted">
            Từ vựng do giáo viên Lucy Tutor soạn theo từng Unit sách Tiếng Anh Global Success. Hệ thống tự kiểm tra mỗi cuối ngày và bổ sung các Unit mới.
          </p>
        </section>

        <ToolFaq faqs={faqs} />
        <ToolCta text="Ôn từ vựng theo lịch SM-2, luyện phát âm cùng AI và chơi trò chơi ôn bài ngay trên điện thoại." />
        <RelatedTools current={HUB} />
      </div>
    </div>
  );
}
