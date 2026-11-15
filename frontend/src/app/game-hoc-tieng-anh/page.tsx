import Link from "next/link";
import { pageMetadata } from "@/lib/seo";
import { PHOTOS } from "@/lib/photos";
import { ToolBanner, ToolJsonLd, ToolFaq, ToolCta, RelatedTools, ToolNextSteps, type Faq } from "@/components/tools/ToolPage";
import QilinRunEmbed from "@/components/tools/QilinRunEmbed";
import { getFlashGrades, gradeWordCount, gradeSlug } from "@/lib/tools/flashcards";

// Từ khoá chính: "game học tiếng anh" (+ "online", "miễn phí" ở title/description vì là cụm người tìm hay gõ kèm)
// Từ khoá phụ: game tiếng anh online, trò chơi học tiếng anh, game học từ vựng tiếng anh, game ngữ pháp tiếng anh,
// game tiếng anh cho học sinh, trò chơi tiếng anh miễn phí, game học tiếng anh lớp 1–12, game học tiếng anh trên điện thoại
// Nghiên cứu (11/2026, đọc kết quả tìm kiếm Google VN — không có số lượt tìm kiếm thật): trang 1 của "game học tiếng anh" là bài tổng hợp top-N
// của cửa hàng điện thoại (FPT Shop, Hoàng Hà, CellphoneS, Viettel Store), PREP và trang App Store. Cách tạo khác biệt: game CHƠI ĐƯỢC NGAY trên trang
// (không phải danh sách app), có kiến thức theo SGK lớp 1–12 và ngữ pháp, nên các mục bên dưới bám đúng cụm người dùng tìm (từ vựng, ngữ pháp, điện thoại, học sinh).
// Game thứ hai (cần tài khoản) có trang riêng: /game-nong-trai-hoc-tieng-anh — nhớ liên kết chéo 2 trang.
// (giả thuyết — kiểm lại bằng tab SEO Performance ở /administrator sau 4–8 tuần)
const PATH = "/game-hoc-tieng-anh";
const TITLE = "Game Học Tiếng Anh Online Miễn Phí – Qilin Run";
const DESCRIPTION =
  "Game học tiếng Anh online miễn phí trên máy tính, điện thoại: chạy nhảy cùng rồng Qilin, ôn từ vựng, ngữ pháp A1–C1 và từ vựng SGK lớp 1–12.";

export const metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: PATH,
  image: PHOTOS.qilinRun,
  keywords: [
    "game học tiếng anh", "game tiếng anh online", "trò chơi học tiếng anh", "game học từ vựng tiếng anh",
    "game ngữ pháp tiếng anh", "game tiếng anh cho học sinh", "trò chơi tiếng anh miễn phí", "game học tiếng anh lớp 6",
    "game học tiếng anh trên điện thoại", "game học tiếng anh miễn phí", "học tiếng anh qua game",
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
  { q: "Học tiếng Anh qua game có hiệu quả không?", a: "Game giúp bạn có động lực quay lại mỗi ngày và nhớ lại từ ngay trong lúc chơi, nhưng chỉ hiệu quả khi bạn thật sự phải trả lời câu hỏi thay vì chỉ xem đáp án. Ở Qilin Run, mỗi cổng kiến thức đều yêu cầu chọn hoặc điền đúng từ, trả lời sai vẫn xem được đáp án và giải thích. Game là công cụ ôn tập vui; để tiến bộ đều bạn vẫn nên kết hợp ôn từ theo lịch và luyện nghe, nói, đọc, viết." },
  { q: "Qilin Run khác gì Nông Trại Qilin?", a: "Qilin Run là game chạy nhảy, chơi ngay không cần đăng nhập, mỗi lượt vài phút để ôn nhanh một bộ thẻ. Nông Trại Qilin là game trồng trọt cần tài khoản: mỗi ô đất là một từ, cây chín theo lịch ôn SRS nên giúp ghi nhớ lâu dài, kèm đơn hàng, chuồng trại và nuôi Qilin." },
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

        <section className="mt-12 space-y-4 text-foreground/90 leading-relaxed max-w-4xl">
          <h2 className="ui-section-title text-xl">Vì sao nên học tiếng Anh bằng game?</h2>
          <p>
            Học từ vựng bằng cách đọc lại danh sách rất dễ chán và dễ quên. Một game học tiếng Anh tốt giữ bạn quay lại vì có thử thách và phần thưởng, đồng thời buộc bạn phải
            <b> nhớ lại</b> từ để đi tiếp. Trong Qilin Run, từ vựng và ngữ pháp xuất hiện đúng lúc bạn cần chọn đáp án để mở cổng, nên bạn gặp lại cùng một từ nhiều lần trong
            ngữ cảnh câu ví dụ thay vì học thuộc lòng một lần. Game phù hợp để khởi động mỗi ngày, ôn nhanh trước giờ kiểm tra hoặc rèn phản xạ; bạn nên kết hợp thêm ôn từ
            theo lịch để nhớ lâu hơn.
          </p>

          <h2 className="ui-section-title text-xl pt-4">Game học từ vựng và ngữ pháp tiếng Anh, chơi được trên điện thoại</h2>
          <p>
            Qilin Run là <b>game học từ vựng tiếng Anh</b> và <b>game ngữ pháp tiếng Anh</b> chạy ngay trong trình duyệt, không cần tải ứng dụng, không cần đăng ký. Trên điện thoại
            cầm dọc có nút Nhảy lớn; cầm ngang bạn chạm bất kỳ đâu trên màn hình để nhảy và khung game tự phóng rộng. Bạn có thể bật chế độ toàn màn hình để chơi gọn hơn.
          </p>

          <h2 className="ui-section-title text-xl pt-4">Trò chơi tiếng Anh cho học sinh từ lớp 1 đến lớp 12</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><b>Tiểu học (lớp 1–5):</b> chọn mục Sách giáo khoa để chơi với từ vựng Global Success theo từng Unit, hoặc mức Dễ (A1–A2) ở các chủ đề gia đình, trường học, đồ ăn.</li>
            <li><b>THCS (lớp 6–9):</b> ôn từ vựng theo Unit và các thẻ ngữ pháp cơ bản như thì động từ, so sánh, câu bị động.</li>
            <li><b>THPT (lớp 10–12):</b> chọn mức Trung bình (B1) hoặc Khó (B2–C1) để ôn câu điều kiện, mệnh đề quan hệ, động từ khuyết thiếu và từ vựng học thuật.</li>
            <li><b>Người đi làm:</b> luyện từ vựng chủ đề công việc, công nghệ, du lịch ở mức B1–C1.</li>
          </ul>
          <p>
            Muốn ôn từ lâu dài kiểu game nông trại, hãy thử{" "}
            <Link href="/game-nong-trai-hoc-tieng-anh" className="text-primary font-semibold hover:underline">Nông Trại Qilin – game trồng từ vựng, thu hoạch bằng trí nhớ</Link>.
          </p>
        </section>

        <ToolNextSteps links={[
          { href: "/game-nong-trai-hoc-tieng-anh", label: "Game nông trại học tiếng Anh Qilin Farm", text: "Trồng từ vựng, cây chín theo lịch ôn SRS để nhớ lâu hơn (cần tài khoản, dùng thử 3 ngày)." },
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
