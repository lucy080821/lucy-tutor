import { Fragment } from "react";
import Link from "next/link";
import { pageMetadata } from "@/lib/seo";
import { ToolBanner, ToolJsonLd, ToolFaq, ToolCta, RelatedTools, ToolNextSteps, type Faq } from "@/components/tools/ToolPage";
import { PHOTOS } from "@/lib/photos";
import { GRADE_NUMBERS, UPDATING_TEXT, getFlashGrades, gradeWordCount, readyUnits } from "@/lib/tools/flashcards";

// Từ khoá chính: "flashcard global success pdf" (Search Console 10/2026: top 9 với "flashcard global success 1 pdf")
// + "flashcard tiếng anh global success"
// Từ khoá phụ: flashcard tiếng anh lớp 1/2/…/12 global success (pdf), flashcard tiếng anh theo chủ đề pdf,
// từ vựng tiếng anh theo unit, thẻ từ vựng tiếng anh in được
const PATH = "/flashcard-tieng-anh";
const TITLE = "Flashcard Global Success Lớp 1–12 PDF Miễn Phí";
const DESCRIPTION =
  "Tải miễn phí flashcard Global Success 1 PDF đến lớp 12: thẻ từ vựng tiếng Anh theo từng Unit, có phiên âm, lật thẻ online, nghe phát âm, in 12 thẻ/trang A4.";

export const metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: PATH,
  image: PHOTOS.flashcard,
  keywords: [
    "flashcard global success pdf", ...GRADE_NUMBERS.map((g) => `flashcard global success ${g} pdf`),
    "flashcard tiếng anh", "flashcard tiếng anh global success", "flashcard tiếng anh pdf", "flashcard tiếng anh theo chủ đề pdf",
    ...GRADE_NUMBERS.map((g) => `flashcard tiếng anh lớp ${g} global success`),
    "từ vựng tiếng anh theo unit",
  ],
});

const CRUMBS = [{ name: "Flashcard tiếng Anh", href: PATH }];

const FAQS: Faq[] = [
  { q: "Từ vựng flashcard lấy từ đâu?", a: "Từ vựng do giáo viên Lucy Tutor soạn cho từng Unit sách Tiếng Anh Global Success trong bài học trên lớp, kèm phiên âm và câu ví dụ. Unit nào chưa có sẽ ghi \"Hệ thống đang cập nhật...\" — hệ thống tự kiểm tra mỗi cuối ngày và bổ sung ngay khi có Unit mới." },
  { q: "Tải flashcard Global Success 1 PDF ở đâu?", a: "Bấm \"Lớp 1\" ở mục \"Tải PDF nhanh theo lớp\" đầu trang (hoặc thẻ Flashcard Global Success 1 PDF bên dưới), rồi bấm \"Tải PDF lớp 1 miễn phí\". Các lớp 2–12 làm tương tự." },
  { q: "Tải flashcard PDF có mất phí không?", a: "Miễn phí và không cần đăng nhập. Bạn có thể tải PDF từng Unit hoặc cả lớp, mỗi trang A4 có 12 thẻ." },
  { q: "In flashcard PDF như thế nào?", a: "In một mặt trên giấy A4 (nên dùng giấy dày), cắt theo viền nét đứt rồi gấp đôi mỗi thẻ theo đường giữa. Một mặt là từ tiếng Anh, mặt kia là nghĩa tiếng Việt — phần nghĩa đã được in xoay ngược để sau khi gấp cả hai mặt đều đọc xuôi." },
  { q: "Học flashcard thế nào cho nhớ lâu?", a: "Nhìn từ tiếng Anh, tự nói nghĩa trước khi lật thẻ; thẻ nào nhớ chắc thì để riêng, thẻ chưa nhớ ôn lại sau 1 ngày, 3 ngày, 1 tuần. Học viên Lucy Tutor có Phòng Gym Từ Vựng tự lên lịch ôn theo thuật toán SM-2." },
];

export default async function Page() {
  const grades = await getFlashGrades();
  // Lớp đã có từ vựng (trang /lop-N được index) — link chữ đúng từ khoá để Google chuyển dần thứ hạng
  // của truy vấn "flashcard global success N pdf" từ trang này sang đúng trang lớp
  const readyGrades = grades.filter((g) => gradeWordCount(g) > 0);
  return (
    <div className="min-h-screen bg-background">
      <ToolJsonLd name={TITLE} path={PATH} description={DESCRIPTION} crumbs={CRUMBS} faqs={FAQS} image={PHOTOS.flashcard} />
      <ToolBanner crumbs={CRUMBS} title="Flashcard Global Success Lớp 1–12 PDF – Tải Miễn Phí"
        subtitle="Thẻ từ vựng tiếng Anh theo từng Unit: chọn lớp để tải PDF in ngay, hoặc lật thẻ online và nghe phát âm."
        photo={PHOTOS.flashcard} highlights={["Lớp 1 → lớp 12", "Tải PDF in 12 thẻ/trang"]}
        actions={
          <nav aria-label="Tải flashcard PDF theo lớp">
            <p className="text-sm font-bold text-primary mb-2">Tải PDF nhanh theo lớp:</p>
            <ul className="flex flex-wrap gap-2">
              {grades.map((g) => (
                <li key={g.slug}>
                  <Link href={`${PATH}/${g.slug}#tai-pdf`} className={`ui-chip bg-white ${gradeWordCount(g) ? "" : "opacity-60"}`}
                    title={`Flashcard Global Success ${g.grade} PDF`}>Lớp {g.grade}</Link>
                </li>
              ))}
            </ul>
          </nav>
        } />

      <div id="bat-dau" className="max-w-5xl mx-auto px-4 py-6 sm:py-8 scroll-mt-16">
        <h2 className="ui-section-title text-xl mb-5">Chọn lớp để tải flashcard Global Success PDF</h2>
        {readyGrades.length > 0 && (
          <p className="-mt-1 mb-5 text-sm text-foreground/80 leading-relaxed">
            Đã có từ vựng để tải ngay:{" "}
            {readyGrades.map((g, i) => (
              <Fragment key={g.slug}>
                {i > 0 && ", "}
                <Link href={`${PATH}/${g.slug}`} className="font-semibold text-primary hover:underline">Flashcard Global Success {g.grade} PDF</Link>
              </Fragment>
            ))}
            . Các lớp còn lại đang được cập nhật theo từng Unit.
          </p>
        )}
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {grades.map((g) => {
            const words = gradeWordCount(g);
            const ready = readyUnits(g);
            return (
            <li key={g.slug}>
              <Link href={`${PATH}/${g.slug}`} className="ui-card ui-card-hover p-5 flex flex-col h-full">
                <span className="text-xs font-semibold text-muted uppercase tracking-wide">Global Success</span>
                <span className="mt-1 text-xl font-extrabold text-primary">Flashcard Global Success {g.grade} PDF</span>
                <span className="text-sm text-foreground/80">Tiếng Anh lớp {g.grade}</span>
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

        <ToolNextSteps links={[
          { href: "/cach-phat-am-ed-s-es", label: "Cách phát âm đuôi s, es, ed", text: "quy tắc /s/ /z/ /ɪz/ và /t/ /d/ /ɪd/ cho từ vựng số nhiều, động từ quá khứ." },
          { href: "/phonetics", label: "Bảng phiên âm IPA 44 âm", text: "nghe từng âm để đọc đúng phiên âm in trên flashcard." },
          { href: "/games/lop-3", label: "Trò chơi tiếng Anh lớp 3", text: "ôn từ vựng Global Success 3 bằng lật thẻ, đánh vần, nghe và chọn." },
          { href: "/bang-dong-tu-bat-quy-tac", label: "Bảng động từ bất quy tắc", text: "V1 – V2 – V3 kèm nghĩa cho học sinh THCS, THPT." },
        ]} />
        <ToolFaq faqs={FAQS} />
        <ToolCta text="Tự thêm từ vựng của riêng bạn, ôn theo lịch SM-2 và luyện nghe đúng những từ đó trong audio thật." />
        <RelatedTools current={PATH} featured={["/cach-phat-am-ed-s-es", "/phonetics", "/games/lop-3"]} />
      </div>
    </div>
  );
}
