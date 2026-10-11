import Link from "next/link";
import { pageMetadata } from "@/lib/seo";
import { ToolBanner, ToolJsonLd, ToolFaq, ToolCta, RelatedTools, type Faq } from "@/components/tools/ToolPage";
import { PHOTOS } from "@/lib/photos";
import { GRADE_NUMBERS, UPDATING_TEXT, getFlashGrades, gradeWordCount, readyUnits } from "@/lib/tools/flashcards";

// Từ khoá chính: "flashcard tiếng anh global success"
// Từ khoá phụ: flashcard tiếng anh lớp 1/2/…/12 global success (pdf), flashcard tiếng anh theo chủ đề pdf,
// từ vựng tiếng anh theo unit, thẻ từ vựng tiếng anh in được
const PATH = "/flashcard-tieng-anh";
const TITLE = "Flashcard Tiếng Anh Global Success Lớp 1–12 (Tải PDF Miễn Phí)";
const DESCRIPTION =
  "Flashcard từ vựng tiếng Anh theo từng Unit sách Global Success lớp 1 đến lớp 12: lật thẻ online, nghe phát âm và tải flashcard PDF miễn phí để in.";

export const metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: PATH,
  image: PHOTOS.flashcard,
  keywords: [
    "flashcard tiếng anh", "flashcard tiếng anh global success", "flashcard tiếng anh pdf", "flashcard tiếng anh theo chủ đề pdf",
    ...GRADE_NUMBERS.map((g) => `flashcard tiếng anh lớp ${g} global success`),
    "từ vựng tiếng anh theo unit",
  ],
});

const CRUMBS = [{ name: "Flashcard tiếng Anh", href: PATH }];

const FAQS: Faq[] = [
  { q: "Từ vựng flashcard lấy từ đâu?", a: "Từ vựng do giáo viên Lucy Tutor soạn cho từng Unit sách Tiếng Anh Global Success trong bài học trên lớp, kèm phiên âm và câu ví dụ. Unit nào chưa có sẽ ghi \"Hệ thống đang cập nhật...\" — hệ thống tự kiểm tra mỗi cuối ngày và bổ sung ngay khi có Unit mới." },
  { q: "Tải flashcard PDF có mất phí không?", a: "Miễn phí và không cần đăng nhập. Bạn có thể tải PDF từng Unit hoặc cả lớp, mỗi trang A4 có 12 thẻ." },
  { q: "In flashcard PDF như thế nào?", a: "In một mặt trên giấy A4 (nên dùng giấy dày), cắt theo viền nét đứt rồi gấp đôi mỗi thẻ theo đường giữa. Một mặt là từ tiếng Anh, mặt kia là nghĩa tiếng Việt — phần nghĩa đã được in xoay ngược để sau khi gấp cả hai mặt đều đọc xuôi." },
  { q: "Học flashcard thế nào cho nhớ lâu?", a: "Nhìn từ tiếng Anh, tự nói nghĩa trước khi lật thẻ; thẻ nào nhớ chắc thì để riêng, thẻ chưa nhớ ôn lại sau 1 ngày, 3 ngày, 1 tuần. Học viên Lucy Tutor có Phòng Gym Từ Vựng tự lên lịch ôn theo thuật toán SM-2." },
];

export default async function Page() {
  const grades = await getFlashGrades();
  return (
    <div className="min-h-screen bg-background">
      <ToolJsonLd name={TITLE} path={PATH} description={DESCRIPTION} crumbs={CRUMBS} faqs={FAQS} image={PHOTOS.flashcard} />
      <ToolBanner crumbs={CRUMBS} title="Flashcard Tiếng Anh Global Success Lớp 1–12"
        subtitle="Thẻ từ vựng theo từng Unit: lật thẻ online, nghe phát âm và tải PDF miễn phí để in."
        photo={PHOTOS.flashcard} highlights={["Lớp 1 → lớp 12", "Tải PDF in 12 thẻ/trang"]} cta="Chọn lớp" />

      <div id="bat-dau" className="max-w-5xl mx-auto px-4 py-6 sm:py-8 scroll-mt-16">
        <h2 className="ui-section-title text-xl mb-5">Chọn lớp</h2>
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {grades.map((g) => {
            const words = gradeWordCount(g);
            const ready = readyUnits(g);
            return (
            <li key={g.slug}>
              <Link href={`${PATH}/${g.slug}`} className="ui-card ui-card-hover p-5 flex flex-col h-full">
                <span className="text-xs font-semibold text-muted uppercase tracking-wide">Global Success</span>
                <span className="mt-1 text-xl font-extrabold text-primary">Flashcard Tiếng Anh Lớp {g.grade}</span>
                <span className="mt-1 text-sm text-muted">{words ? `${ready.length}/${g.units.length} Unit · ${words} thẻ từ vựng` : UPDATING_TEXT}</span>
                <span className="mt-3 text-sm text-foreground/80 line-clamp-2">{(ready.length ? ready : g.units).slice(0, 3).map((u) => u.title).join(", ")}…</span>
                <span className="btn-outline mt-4 self-start px-4 py-2 text-sm">{words ? "Xem & tải PDF" : "Xem các Unit"}</span>
              </Link>
            </li>
            );
          })}
        </ul>

        <section className="mt-12 space-y-4 text-foreground/90 leading-relaxed">
            <h2 className="ui-section-title text-xl">Vì sao nên học từ vựng bằng flashcard?</h2>
            <p>
              Flashcard buộc người học tự nhớ lại nghĩa trước khi xem đáp án (active recall) — cách ghi nhớ hiệu quả hơn
              nhiều so với đọc lại danh sách từ. Học theo đúng Unit trên lớp giúp ôn bài trước kiểm tra, còn bản PDF in ra
              phù hợp cho phụ huynh cùng con ôn tập mà không cần dùng điện thoại.
            </p>
        </section>

        <ToolFaq faqs={FAQS} />
        <ToolCta text="Tự thêm từ vựng của riêng bạn, ôn theo lịch SM-2 và luyện nghe đúng những từ đó trong audio thật." />
        <RelatedTools current={PATH} />
      </div>
    </div>
  );
}
