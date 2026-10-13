import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { pageMetadata } from "@/lib/seo";
import { ToolBanner, ToolJsonLd, ToolFaq, ToolCta, RelatedTools, ToolNextSteps, type Faq } from "@/components/tools/ToolPage";
import FlashcardViewer, { FlashcardPdfButton } from "@/components/tools/FlashcardViewer";
import { GRADE_NUMBERS, UPDATING_TEXT, getFlashGrade, gradeSlug, gradeWordCount, readyUnits } from "@/lib/tools/flashcards";
import { PHOTOS } from "@/lib/photos";

// Từ khoá chính mỗi trang: "flashcard global success N pdf" (Search Console 10/2026: "flashcard global success 1 pdf")
// Từ khoá phụ: flashcard tiếng anh lớp N global success (pdf), từ vựng tiếng anh lớp N, từ vựng tiếng anh lớp N theo unit
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
  const units = readyUnits(g).length;
  const meta = pageMetadata({
    title: `Flashcard Global Success ${g.grade} PDF – Tải Miễn Phí`,
    description: words
      ? `Tải miễn phí flashcard Global Success ${g.grade} PDF (tiếng Anh lớp ${g.grade}): ${words} thẻ từ vựng theo ${units} Unit, có phiên âm, lật thẻ online và in 12 thẻ/trang A4.`
      : `Flashcard Global Success ${g.grade} PDF (tiếng Anh lớp ${g.grade}) theo từng Unit — từ vựng đang được cập nhật, tải miễn phí khi có.`,
    path: `${HUB}/${g.slug}`,
    image: PHOTOS.flashcard,
    keywords: [
      `flashcard global success ${g.grade} pdf`, `flashcard global success ${g.grade}`,
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
  const title = `Flashcard Global Success ${g.grade} PDF – Tiếng Anh Lớp ${g.grade}`;
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
    { q: `Tải flashcard Global Success ${g.grade} PDF ở đâu?`, a: `Bấm "Tải PDF lớp ${g.grade} miễn phí" ở đầu trang để tải toàn bộ các Unit đã có, không cần đăng nhập. File in trên giấy A4, mỗi trang 12 thẻ.` },
    { q: "Có tải PDF từng Unit được không?", a: "Có. Chọn Unit rồi bấm \"Tải PDF\" để tải riêng Unit đó, hoặc bấm \"Tải PDF cả lớp\" để tải toàn bộ các Unit đã có. Mỗi trang A4 có 12 thẻ kiểu gấp đôi." },
    { q: "Từ vựng lấy từ đâu?", a: "Từ vựng do giáo viên Lucy Tutor soạn cho từng Unit sách Global Success trong bài học trên lớp, kèm phiên âm và câu ví dụ. Hệ thống tự kiểm tra mỗi cuối ngày và cập nhật thêm Unit mới." },
  ];

  return (
    <div className="min-h-screen bg-background">
      <ToolJsonLd name={title} path={path} description={description} crumbs={crumbs} faqs={faqs} image={PHOTOS.flashcard} />
      <ToolBanner crumbs={crumbs} title={title}
        subtitle={words ? `${words} thẻ từ vựng theo Unit — lật thẻ, nghe phát âm và tải PDF để in.` : UPDATING_TEXT}
        photo={PHOTOS.flashcard} highlights={[words ? `${ready.length}/${g.units.length} Unit · ${words} thẻ` : UPDATING_TEXT, "Tải PDF miễn phí"]}
        actions={words ? (
          <div className="flex flex-col sm:flex-row gap-3">
            <FlashcardPdfButton grade={g.grade} />
            <a href="#bat-dau" className="btn-outline bg-white px-6 py-3.5 text-base text-center">Học flashcard online</a>
          </div>
        ) : undefined} cta="Xem các Unit" />

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

        <ToolNextSteps links={[
          { href: "/cach-phat-am-ed-s-es", label: "Cách phát âm đuôi s, es, ed", text: "đọc đúng âm cuối khi học từ số nhiều và động từ quá khứ trong flashcard." },
          { href: "/phonetics", label: "Bảng phiên âm IPA 44 âm", text: "bấm nghe từng âm để đọc được phiên âm in trên thẻ." },
          { href: "/bang-dong-tu-bat-quy-tac", label: "Bảng động từ bất quy tắc", text: "V1 – V2 – V3 kèm nghĩa, tải PDF để học cùng flashcard." },
          ...(g.grade === 3 ? [{ href: "/games/lop-3", label: "Trò chơi tiếng Anh lớp 3", text: "ôn lại đúng từ vựng Global Success 3 bằng 5 trò chơi." }] : []),
        ]} />
        <ToolFaq faqs={faqs} />
        <ToolCta text="Ôn từ vựng theo lịch SM-2, luyện phát âm cùng AI và chơi trò chơi ôn bài ngay trên điện thoại." />
        <RelatedTools current={HUB} featured={["/cach-phat-am-ed-s-es", "/phonetics", "/bang-dong-tu-bat-quy-tac"]} />
      </div>
    </div>
  );
}
