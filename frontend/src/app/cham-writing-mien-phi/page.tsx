import { pageMetadata } from "@/lib/seo";
import { ToolBanner, ToolJsonLd, ToolFaq, ToolCta, RelatedTools, type Faq } from "@/components/tools/ToolPage";
import { PHOTOS } from "@/lib/photos";
import FreeWritingChecker from "@/components/tools/FreeWritingChecker";

// Từ khoá chính: "chấm điểm writing online free" / "chấm ielts writing ai"
// Từ khoá phụ: chấm ielts writing task 2, chấm ielts writing task 1, chấm điểm writing ielts free,
// chấm writing online miễn phí, chấm bài writing tiếng anh, sửa bài writing ielts, chấm điểm writing free
const PATH = "/cham-writing-mien-phi";
const TITLE = "Chấm Điểm IELTS Writing Online Free Bằng AI (Task 1, Task 2)";
const DESCRIPTION =
  "Chấm IELTS Writing Task 1, Task 2 và đoạn văn tiếng Anh miễn phí bằng AI, không cần đăng nhập. Ước tính band theo 4 tiêu chí IELTS, chỉ ra lỗi sai từng câu kèm bản sửa và gợi ý tăng điểm.";

export const metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: PATH,
  image: PHOTOS.writing,
  keywords: [
    "chấm điểm writing online free", "chấm ielts writing ai", "chấm ielts writing task 2", "chấm ielts writing task 1",
    "chấm điểm writing ielts free", "chấm writing online miễn phí", "chấm bài writing tiếng anh", "sửa bài writing ielts",
    "chấm ielts writing free", "chấm điểm writing",
  ],
});

const CRUMBS = [{ name: "Chấm Writing miễn phí", href: PATH }];

const FAQS: Faq[] = [
  { q: "Chấm Writing miễn phí có giới hạn gì không?", a: "Mỗi người được chấm 3 bài mỗi ngày, mỗi bài từ 50 đến 350 từ (tối đa 2.500 ký tự). Lượt bị lỗi do hệ thống sẽ không bị tính. Học viên Lucy Tutor được luyện viết và chấm không giới hạn lượt." },
  { q: "AI chấm IELTS Writing theo tiêu chí nào?", a: "Bài IELTS được chấm theo 4 tiêu chí công khai của IELTS: Task Achievement (Task 1) hoặc Task Response (Task 2), Coherence & Cohesion, Lexical Resource, Grammatical Range & Accuracy. Band bài viết là trung bình 4 tiêu chí, làm tròn xuống về mức .0 hoặc .5." },
  { q: "Điểm AI chấm có chính xác như giám khảo thật không?", a: "Không hoàn toàn. AI ước tính dựa trên tiêu chí chấm công khai và có thể lệch so với giám khảo thật, nhất là ở band cao. Hãy dùng kết quả để biết lỗi cần sửa và xu hướng tiến bộ, không xem là điểm thi chính thức." },
  { q: "Task 1 có biểu đồ thì AI chấm thế nào?", a: "AI không xem được hình ảnh. Bạn nên dán đề và mô tả ngắn số liệu chính của biểu đồ vào ô Đề bài; AI sẽ chấm cách bạn mô tả, so sánh và tổ chức bài dựa trên thông tin đó." },
  { q: "Bài viết của tôi có bị lưu lại không?", a: "Không. Bài viết chỉ được gửi tới AI để chấm và không được lưu vào cơ sở dữ liệu của Lucy Tutor." },
];

export default function Page() {
  return (
    <div className="min-h-screen bg-background">
      <ToolJsonLd name={TITLE} path={PATH} description={DESCRIPTION} crumbs={CRUMBS} faqs={FAQS} image={PHOTOS.writing} />
      <ToolBanner crumbs={CRUMBS} title="Chấm Writing Miễn Phí Bằng AI"
        subtitle="Dán bài IELTS Task 1, Task 2 hoặc đoạn văn tiếng Anh — AI ước tính band theo 4 tiêu chí và sửa lỗi từng câu."
        photo={PHOTOS.writing} highlights={["Chấm theo 4 tiêu chí IELTS", "Sửa lỗi từng câu"]} cta="Chấm bài ngay" />

      <div id="bat-dau" className="max-w-5xl mx-auto px-4 py-6 sm:py-8 scroll-mt-16">
        <FreeWritingChecker />

        <section className="mt-12 space-y-4 text-foreground/90 leading-relaxed">
          <h2 className="ui-section-title text-xl">4 tiêu chí chấm IELTS Writing</h2>
          <div className="overflow-x-auto">
            <table className="ui-table w-full text-sm">
              <thead><tr><th>Tiêu chí</th><th>Giám khảo đánh giá</th></tr></thead>
              <tbody>
                <tr><td><b>Task Achievement / Task Response</b></td><td>Trả lời đúng và đủ yêu cầu đề, ý chính rõ ràng, có dẫn chứng (Task 2) hoặc nêu được xu hướng, số liệu nổi bật (Task 1).</td></tr>
                <tr><td><b>Coherence & Cohesion</b></td><td>Bố cục đoạn hợp lý, ý nối tiếp mạch lạc, dùng từ nối và đại từ thay thế tự nhiên.</td></tr>
                <tr><td><b>Lexical Resource</b></td><td>Vốn từ phong phú, chính xác, dùng collocation đúng, ít lỗi chính tả.</td></tr>
                <tr><td><b>Grammatical Range & Accuracy</b></td><td>Đa dạng cấu trúc câu (câu phức, mệnh đề quan hệ, câu điều kiện...) và ít lỗi ngữ pháp.</td></tr>
              </tbody>
            </table>
          </div>
          <div className="pt-4">
              <h2 className="ui-section-title text-xl">Mẹo dùng công cụ hiệu quả</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li>Luôn dán kèm đề bài để tiêu chí Task Response/Task Achievement được chấm sát hơn.</li>
                <li>Sửa đúng các lỗi AI chỉ ra rồi chấm lại để thấy band thay đổi thế nào.</li>
                <li>Ghi lại các lỗi lặp lại (mạo từ, chia động từ, giới từ) vào sổ tay riêng để ôn.</li>
              </ul>
          </div>
        </section>

        <ToolFaq faqs={FAQS} />
        <ToolCta text="Học viên được AI ra đề theo cấp độ A1–C1, chấm chi tiết không giới hạn lượt và lưu lịch sử bài viết." />
        <RelatedTools current={PATH} />
      </div>
    </div>
  );
}
