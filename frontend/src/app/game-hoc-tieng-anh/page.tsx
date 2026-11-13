import Link from "next/link";
import { pageMetadata } from "@/lib/seo";
import { PHOTOS } from "@/lib/photos";
import { ToolBanner, ToolJsonLd, ToolFaq, ToolCta, RelatedTools, ToolNextSteps, type Faq } from "@/components/tools/ToolPage";
import QilinRunEmbed from "@/components/tools/QilinRunEmbed";
import { getFlashGrades, gradeWordCount, gradeSlug } from "@/lib/tools/flashcards";

// Từ khoá chính: "game học tiếng anh"
// Từ khoá phụ: game tiếng anh online, trò chơi học tiếng anh, game học từ vựng tiếng anh, game ngữ pháp tiếng anh,
// game tiếng anh cho học sinh, trò chơi tiếng anh miễn phí, game học tiếng anh lớp 1–12
// (giả thuyết — kiểm lại bằng tab SEO Performance ở /administrator sau 4–8 tuần)
const PATH = "/game-hoc-tieng-anh";
const TITLE = "Game Học Tiếng Anh Miễn Phí – Qilin Run";
const DESCRIPTION =
  "Game học tiếng Anh online miễn phí: chạy nhảy cùng rồng Qilin, học flashcard từ vựng, ngữ pháp A1–C1 và từ vựng SGK lớp 1–12 rồi trả lời để mở cổng.";

export const metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: PATH,
  image: PHOTOS.qilinRun,
  keywords: [
    "game học tiếng anh", "game tiếng anh online", "trò chơi học tiếng anh", "game học từ vựng tiếng anh",
    "game ngữ pháp tiếng anh", "game tiếng anh cho học sinh", "trò chơi tiếng anh miễn phí", "game học tiếng anh lớp 6",
  ],
});

const CRUMBS = [{ name: "Game học tiếng Anh", href: PATH }];

// Khớp với games-src/qilin-run/content.js (8 chủ đề từ vựng + 6 chủ đề ngữ pháp, mỗi chủ đề 3 mức × 6 thẻ)
const VOCAB_TOPICS = [
  ["Gia đình & con người", "mother, cousin, generous, upbringing"],
  ["Trường học & học tập", "homework, scholarship, curriculum"],
  ["Đồ ăn & nấu nướng", "delicious, recipe, nutritious"],
  ["Du lịch & giao thông", "luggage, destination, itinerary"],
  ["Công việc & nghề nghiệp", "colleague, deadline, entrepreneur"],
  ["Sức khoẻ & cơ thể", "medicine, symptom, sedentary"],
  ["Môi trường & thiên nhiên", "recycle, pollution, biodiversity"],
  ["Công nghệ & truyền thông", "password, device, algorithm"],
];
const GRAMMAR_TOPICS = [
  ["Thì động từ", "hiện tại đơn → quá khứ hoàn thành tiếp diễn, đảo ngữ Hardly / No sooner"],
  ["Câu điều kiện & câu ước", "loại 0, 1, 2, 3, hỗn hợp, wish, đảo ngữ Had / Should"],
  ["Câu bị động", "be + V3, bị động với modal, have/get something done, It is said that"],
  ["Mệnh đề quan hệ & liên từ", "who, which, whose, although, despite, whereas"],
  ["Động từ khuyết thiếu", "can, must, have to, should have, needn't have"],
  ["So sánh", "so sánh hơn, nhất, bằng, càng… càng, bội số"],
];

const FAQS: Faq[] = [
  { q: "Game học tiếng Anh Qilin Run có mất phí không?", a: "Không. Game miễn phí, không cần đăng nhập, chơi ngay trên trình duyệt máy tính, điện thoại và máy tính bảng. Kỷ lục được lưu trên chính trình duyệt bạn đang dùng." },
  { q: "Game phù hợp với lứa tuổi nào?", a: "Học sinh tiểu học chơi mục Sách giáo khoa (lớp 1, 3) hoặc mức Dễ (A1–A2). Học sinh THCS, THPT và người đi làm chọn mức Trung bình (B1) hoặc Khó (B2–C1) ở các chủ đề từ vựng và ngữ pháp." },
  { q: "Kiến thức trong game lấy từ đâu?", a: "Mục Sách giáo khoa dùng đúng từ vựng theo Unit sách Global Success mà giáo viên Lucy Tutor đã soạn (giống trang Flashcard tiếng Anh lớp 1–12). Lớp hoặc Unit chưa có từ sẽ hiện \"Đang cập nhật\". Mục Từ vựng và Ngữ pháp gồm 14 chủ đề, mỗi chủ đề chia 3 mức từ A1 đến C1." },
  { q: "Vì sao phải học flashcard trước khi chơi?", a: "Câu hỏi ở 5 cổng kiến thức chỉ lấy trong bộ thẻ bạn vừa học. Học trước rồi chơi giúp bạn nhắc lại từ ngay sau khi học, cách ghi nhớ hiệu quả hơn đọc lại nhiều lần." },
  { q: "Chơi trên điện thoại như thế nào?", a: "Cầm dọc thì bấm nút Nhảy lớn bên dưới khung game, bấm 2 lần để nhảy đôi. Cầm ngang thì chạm bất kỳ đâu trên màn chơi để nhảy, khung game tự kéo rộng để nhìn xa hơn. Nút Toàn màn hình giúp chơi không bị thanh trình duyệt che." },
];

export default async function Page() {
  const grades = await getFlashGrades();
  return (
    <div className="min-h-screen bg-background">
      <ToolJsonLd name={TITLE} path={PATH} description={DESCRIPTION} crumbs={CRUMBS} faqs={FAQS} image={PHOTOS.qilinRun} />
      <ToolBanner crumbs={CRUMBS} title="Game Học Tiếng Anh Qilin Run"
        subtitle="Học flashcard từ vựng, ngữ pháp từ A1 đến C1 hoặc theo sách giáo khoa lớp 1–12, rồi cùng rồng nước Qilin chạy nhảy, nhặt ngọc chữ cái và mở 5 cổng kiến thức."
        photo={PHOTOS.qilinRun} highlights={["14 chủ đề · A1 đến C1", "Từ vựng SGK lớp 1–12"]} cta="Chơi ngay" />

      <div id="bat-dau" className="max-w-6xl mx-auto px-4 py-6 sm:py-8 scroll-mt-16">
        <QilinRunEmbed />

        <section className="mt-12 space-y-4 text-foreground/90 leading-relaxed max-w-4xl">
          <h2 className="ui-section-title text-xl">Cách chơi Qilin Run</h2>
          <ol className="list-decimal pl-6 space-y-2">
            <li><b>Chọn kiến thức:</b> Từ vựng theo chủ đề, Ngữ pháp, hoặc Sách giáo khoa (chọn lớp, Unit và phần khoảng 10 từ). Với từ vựng và ngữ pháp, chọn thêm mức Dễ (A1–A2), Trung bình (B1) hoặc Khó (B2–C1).</li>
            <li><b>Học flashcard:</b> bấm thẻ để lật, nghe phát âm, đọc câu ví dụ. Thẻ ngữ pháp có câu điền chỗ trống, từ khoá dấu hiệu được gạch chân và giải thích quy tắc bằng tiếng Việt.</li>
            <li><b>Chạy và nhảy:</b> Qilin tự chạy, bạn chạm màn hình hoặc nhấn Space để nhảy, nhấn thêm lần nữa trên không để nhảy đôi. Nhặt ngọc chữ cái theo thứ tự để ghép từ, nhảy lên đầu mực &ldquo;lỗi sai&rdquo; để được thêm điểm, tránh rơi xuống nước.</li>
            <li><b>Mở cổng kiến thức:</b> mỗi lượt có 5 cổng. Câu hỏi có 4 kiểu: chọn nghĩa, nghe rồi chọn từ, điền từ vào câu ví dụ và điền chỗ trống ngữ pháp. Trả lời đúng liên tiếp thì điểm nhân lên tới 5 lần, trả lời sai vẫn được xem đáp án và giải thích.</li>
            <li><b>Về đích:</b> nhận 1–3 sao theo số cổng trả lời đúng, xem lại các từ vừa gặp và phá kỷ lục của từng chủ đề.</li>
          </ol>

          <h2 className="ui-section-title text-xl pt-6">Kiến thức trong game</h2>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="font-bold text-primary mb-2">8 chủ đề từ vựng (A1 → C1)</h3>
              <div className="overflow-x-auto">
                <table className="ui-table w-full text-sm">
                  <thead><tr><th>Chủ đề</th><th>Ví dụ từ</th></tr></thead>
                  <tbody>{VOCAB_TOPICS.map(([t, ex]) => <tr key={t}><td>{t}</td><td lang="en">{ex}</td></tr>)}</tbody>
                </table>
              </div>
            </div>
            <div>
              <h3 className="font-bold text-primary mb-2">6 chủ đề ngữ pháp (A1 → C1)</h3>
              <div className="overflow-x-auto">
                <table className="ui-table w-full text-sm">
                  <thead><tr><th>Chủ đề</th><th>Nội dung</th></tr></thead>
                  <tbody>{GRAMMAR_TOPICS.map(([t, ex]) => <tr key={t}><td>{t}</td><td>{ex}</td></tr>)}</tbody>
                </table>
              </div>
            </div>
          </div>
          <p>Mỗi chủ đề có 3 mức, mỗi mức 6 thẻ: <b>Dễ</b> gồm thẻ A1 và A2, <b>Trung bình</b> gồm thẻ B1, <b>Khó</b> gồm thẻ B2 và C1. Chọn mức nào thì game chỉ hỏi kiến thức trong mức đó.</p>

          <h3 className="font-bold text-primary pt-2">Từ vựng sách giáo khoa Global Success lớp 1–12</h3>
          <div className="overflow-x-auto">
            <table className="ui-table w-full text-sm">
              <thead><tr><th>Lớp</th><th>Số từ trong game</th><th>Flashcard để in</th></tr></thead>
              <tbody>
                {grades.map((g) => {
                  const n = gradeWordCount(g);
                  return (
                    <tr key={g.grade}>
                      <td>Lớp {g.grade}</td>
                      <td>{n > 0 ? `${n} từ` : "Đang cập nhật"}</td>
                      <td>{n > 0 ? <Link href={`/flashcard-tieng-anh/${gradeSlug(g.grade)}`} className="text-primary hover:underline">Flashcard lớp {g.grade}</Link> : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <ToolNextSteps links={[
          { href: "/flashcard-tieng-anh", label: "Flashcard tiếng Anh lớp 1–12", text: "In bộ thẻ từ vựng theo Unit để ôn lại trên giấy." },
          { href: "/kiem-tra-trinh-do-tieng-anh", label: "Kiểm tra trình độ tiếng Anh", text: "Làm bài 30 câu để biết nên chọn mức Dễ, Trung bình hay Khó." },
          { href: "/games/lop-3", label: "Trò chơi tiếng Anh lớp 3", text: "5 trò chơi nhỏ ôn từ vựng và mẫu câu Global Success 3." },
        ]} />
        <ToolFaq faqs={FAQS} />
        <ToolCta text="Ôn từ vựng bằng thẻ SRS, luyện 4 kỹ năng cùng AI và làm đề thi thử THPT có tính giờ." />
        <RelatedTools current={PATH} featured={["/flashcard-tieng-anh", "/games/lop-3", "/kiem-tra-trinh-do-tieng-anh"]} />
      </div>
    </div>
  );
}
