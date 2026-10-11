import { pageMetadata } from "@/lib/seo";
import { ToolBanner, ToolJsonLd, ToolFaq, ToolCta, RelatedTools, type Faq } from "@/components/tools/ToolPage";
import { PHOTOS } from "@/lib/photos";
import PlacementTest from "@/components/tools/PlacementTest";

// Từ khoá chính: "kiểm tra trình độ tiếng anh online miễn phí"
// Từ khoá phụ: test trình độ tiếng anh online, test trình độ tiếng anh a1 a2 b1 b2, kiểm tra trình độ tiếng anh cefr,
// test trình độ tiếng anh đầu vào, kiểm tra trình độ tiếng anh cho người mất gốc, trình độ tiếng anh hiện tại
const PATH = "/kiem-tra-trinh-do-tieng-anh";
const TITLE = "Kiểm Tra Trình Độ Tiếng Anh Online Miễn Phí (CEFR A1–C1)";
const DESCRIPTION =
  "Test trình độ tiếng Anh online miễn phí, không cần đăng nhập: 30 câu ngữ pháp, từ vựng, đọc hiểu, khoảng 15 phút. Biết ngay trình độ CEFR A1, A2, B1, B2, C1 kèm đáp án và gợi ý ôn tập.";

export const metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: PATH,
  image: PHOTOS.placement,
  keywords: [
    "kiểm tra trình độ tiếng anh", "kiểm tra trình độ tiếng anh online miễn phí", "test trình độ tiếng anh online",
    "test trình độ tiếng anh miễn phí", "test trình độ tiếng anh a1 a2 b1 b2", "kiểm tra trình độ tiếng anh cefr",
    "test trình độ tiếng anh đầu vào", "kiểm tra trình độ tiếng anh cho người mất gốc", "trình độ tiếng anh của bạn",
  ],
});

const CRUMBS = [{ name: "Kiểm tra trình độ tiếng Anh", href: PATH }];

const FAQS: Faq[] = [
  { q: "Bài kiểm tra trình độ tiếng Anh này có mất phí không?", a: "Hoàn toàn miễn phí và không cần đăng nhập. Bạn làm bài, xem kết quả và đáp án giải thích ngay trên trình duyệt." },
  { q: "Kết quả có chính xác như chứng chỉ không?", a: "Không. Đây là bài test nhanh 30 câu để ước lượng trình độ và định hướng ôn tập. Muốn có chứng nhận chính thức, bạn cần thi các kỳ thi chuẩn hoá có giám sát như IELTS, Cambridge hoặc VSTEP." },
  { q: "Cách tính trình độ như thế nào?", a: "Đề có 6 câu cho mỗi cấp A1, A2, B1, B2, C1, độ khó tăng dần. Bạn đạt một cấp khi đúng từ 4/6 câu của cấp đó và đã đạt mọi cấp thấp hơn. Trình độ của bạn là cấp cao nhất đạt được." },
  { q: "Người mất gốc có làm được không?", a: "Có. Các câu đầu ở cấp A1 rất cơ bản. Câu nào không biết, hãy bỏ trống thay vì đoán để kết quả sát với trình độ thật. Nếu kết quả là dưới A1, trang kết quả sẽ gợi ý nên bắt đầu học từ đâu." },
  { q: "Trình độ B1, B2 tương đương IELTS bao nhiêu?", a: "Theo mức tham chiếu thường được Cambridge công bố: B1 tương đương khoảng IELTS 4.0–5.0, B2 khoảng 5.5–6.5, C1 khoảng 7.0–8.0. Đây là mức tham khảo, không phải quy đổi chính thức giữa hai bài thi." },
];

export default function Page() {
  return (
    <div className="min-h-screen bg-background">
      <ToolJsonLd name={TITLE} path={PATH} description={DESCRIPTION} crumbs={CRUMBS} faqs={FAQS} image={PHOTOS.placement} />
      <ToolBanner crumbs={CRUMBS} title="Kiểm Tra Trình Độ Tiếng Anh Online Miễn Phí"
        subtitle="30 câu, khoảng 15 phút — biết ngay trình độ CEFR A1–C1 của bạn, kèm đáp án và giải thích."
        photo={PHOTOS.placement} highlights={["30 câu · khoảng 15 phút", "Biết ngay trình độ A1–C1"]} cta="Làm bài kiểm tra ngay" />

      <div id="bat-dau" className="max-w-5xl mx-auto px-4 py-6 sm:py-8 scroll-mt-16">
        <PlacementTest />

        <section className="mt-12 space-y-4 text-foreground/90 leading-relaxed">
            <h2 className="ui-section-title text-xl">Khung trình độ CEFR là gì?</h2>
            <p>
              CEFR (Khung tham chiếu chung châu Âu về ngôn ngữ) chia năng lực tiếng Anh thành 6 bậc từ A1 đến C2.
              Ở Việt Nam, khung năng lực ngoại ngữ 6 bậc dùng cho kỳ thi VSTEP cũng được xây dựng dựa trên CEFR
              (bậc 1–6 tương ứng A1–C2). Bài test này đo từ A1 đến C1 — phạm vi phù hợp với học sinh THPT và người đi làm.
            </p>
          <div className="overflow-x-auto">
            <table className="ui-table w-full text-sm">
              <thead><tr><th>Cấp độ</th><th>Bạn có thể</th></tr></thead>
              <tbody>
                <tr><td><b>A1</b></td><td>Hiểu và dùng câu đơn giản về bản thân, gia đình, sinh hoạt hằng ngày.</td></tr>
                <tr><td><b>A2</b></td><td>Giao tiếp trong tình huống quen thuộc, mô tả trải nghiệm ngắn.</td></tr>
                <tr><td><b>B1</b></td><td>Xử lý phần lớn tình huống thường gặp, viết đoạn văn liền mạch.</td></tr>
                <tr><td><b>B2</b></td><td>Đọc hiểu văn bản phức tạp, trình bày quan điểm rõ ràng, chi tiết.</td></tr>
                <tr><td><b>C1</b></td><td>Dùng ngôn ngữ linh hoạt, hiệu quả cho học tập và công việc.</td></tr>
              </tbody>
            </table>
          </div>
          <h2 className="ui-section-title text-xl pt-4">Vì sao nên test trình độ tiếng Anh trước khi học?</h2>
          <p>
            Biết trình độ hiện tại giúp bạn chọn tài liệu vừa sức: học quá dễ thì chậm tiến bộ, quá khó thì dễ nản.
            Kết quả theo từng cấp còn cho thấy bạn hổng ở đâu — ví dụ đúng hết A2 nhưng sai nhiều câu B1 nghĩa là nên
            tập trung vào câu điều kiện, câu bị động, câu tường thuật trước khi luyện đề nâng cao.
          </p>
        </section>

        <ToolFaq faqs={FAQS} />
        <ToolCta text="Lucy Tutor có bài luyện Reading, Listening, Writing, Speaking theo từng cấp A1–C1 và AI chấm chi tiết." />
        <RelatedTools current={PATH} />
      </div>
    </div>
  );
}
