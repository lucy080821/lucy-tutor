import Link from "next/link";
import { pageMetadata } from "@/lib/seo";
import { PHOTOS } from "@/lib/photos";
import { ToolBanner, ToolJsonLd, ToolFaq, ToolCta, ToolNextSteps, type Faq } from "@/components/tools/ToolPage";

// Trang giới thiệu CÔNG KHAI của game Nông Trại Qilin. Bản thân /farm cần đăng nhập nên noindex —
// trang này là trang đích từ Google (quy ước: đừng index trang cần đăng nhập, làm trang giới thiệu riêng).
//
// Nghiên cứu từ khoá (11/2026, đọc kết quả tìm kiếm Google VN — KHÔNG có số lượt tìm kiếm thật, chỉ có độ cạnh tranh tương đối):
// - Từ khoá đầu ("game học tiếng anh", "game học từ vựng tiếng anh", "game học tiếng anh trên điện thoại"): trang 1 toàn bài tổng hợp
//   top-N của cửa hàng điện thoại (FPT Shop, Hoàng Hà, CellphoneS, Viettel Store), PREP, trang App Store → khó vượt bằng 1 trang game đơn lẻ.
// - Ngách chưa ai chiếm: "game nông trại học tiếng anh", "game trồng cây học từ vựng" — kết quả trả về chỉ là app trẻ em không dạy tiếng Anh
//   hoặc app từ vựng chủ đề nông trại, KHÔNG có game trồng-từ-ôn-theo-lịch → đây là từ khoá chính của trang.
// - Từ khoá hỗ trợ (thông tin): "học từ vựng bằng flashcard", "spaced repetition là gì" (PREP/IDP đang giữ) → có mục giải thích SRS.
// Từ khoá chính: "game nông trại học tiếng anh"
// Từ khoá phụ: game học từ vựng tiếng anh, game trồng cây học từ vựng, học từ vựng tiếng anh bằng game, game học tiếng anh miễn phí,
// game học tiếng anh online, học từ vựng theo spaced repetition, game ngữ pháp tiếng anh, game học tiếng anh trên điện thoại
// (giả thuyết — kiểm lại bằng tab SEO Performance ở /administrator sau 4–8 tuần)
const PATH = "/game-nong-trai-hoc-tieng-anh";
const TITLE = "Game Nông Trại Học Tiếng Anh – Qilin Farm";
const DESCRIPTION =
  "Game nông trại học từ vựng tiếng Anh: trồng từ thành cây, ôn theo lịch SRS để thu hoạch, giao đơn, nuôi Qilin. Dùng thử miễn phí 3 ngày.";

export const metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: PATH,
  image: PHOTOS.farmScene,
  keywords: [
    "game nông trại học tiếng anh", "game học từ vựng tiếng anh", "game trồng cây học từ vựng", "học từ vựng tiếng anh bằng game",
    "game học tiếng anh miễn phí", "game học tiếng anh online", "học từ vựng theo spaced repetition", "game học tiếng anh trên điện thoại",
  ],
});

const CRUMBS = [{ name: "Game học tiếng Anh", href: "/game-hoc-tieng-anh" }, { name: "Nông trại Qilin", href: PATH }];

const FAQS: Faq[] = [
  { q: "Game nông trại học tiếng Anh Qilin Farm là gì?", a: "Qilin Farm (Nông Trại Qilin) là game nông trại chạy trên trình duyệt, nơi mỗi ô đất là một từ vựng, một thẻ ngữ pháp hoặc một thẻ phát âm tiếng Anh. Bạn trồng từ, chờ cây chín theo đúng lịch ôn tập ngắt quãng (SRS) rồi thu hoạch bằng cách nhớ lại từ đó. Nhớ đúng thì được xu, kinh nghiệm và nông sản, nhớ sai thì cây héo và bạn học lại." },
  { q: "Chơi game có mất phí không?", a: "Bạn tạo tài khoản học viên và dùng thử miễn phí 3 ngày, không cần thẻ tín dụng. Sau thời gian dùng thử, học viên tự do được giáo viên phụ trách kích hoạt theo học phí tháng; học viên đã vào lớp của giáo viên Lucy Tutor không bị giới hạn dùng thử. Game chạy trên máy tính, điện thoại và máy tính bảng, không cần cài ứng dụng." },
  { q: "Vì sao cây phải chờ lâu mới chín? Có mua để chín nhanh được không?", a: "Thời gian cây lớn chính là khoảng cách đến lần ôn tiếp theo mà thuật toán SM-2 tính cho từ đó: từ mới chín sau 10 phút, từ càng nhớ chắc thì khoảng chờ càng dài (có thể lên tới vài tuần). Vì vậy xu và kim cương không mua được thời gian chờ. Muốn rút ngắn, bạn phải học thêm: Ôn sớm một từ chưa tới hạn, hoặc Tưới nước bằng cách gõ lại một từ đã học khác." },
  { q: "Cây chờ càng lâu có lời hơn không?", a: "Có. Phần thưởng xu, kinh nghiệm và số nông sản nhân theo độ dài chu kỳ: cây chờ 1 giờ thưởng ×1,15, 1 ngày ×1,8, 7 ngày ×3,2 và từ 14 ngày trở lên ×4. Từ bạn nhớ càng lâu thì thu hoạch càng lớn." },
  { q: "Game dạy những nội dung gì?", a: "Có 20 chủ đề từ vựng (360 từ, từ A1 đến B2), 9 bộ ngữ pháp (99 thẻ: các thì, câu bị động, câu điều kiện, mệnh đề quan hệ, giới từ…), 6 bộ phát âm (72 thẻ: đuôi -ed, đuôi -s/-es, trọng âm, cặp âm dễ nhầm, phiên âm IPA) và từ vựng sách giáo khoa Global Success lớp 1–12 theo Unit. Từ vựng trong deck ôn tập Lucy Tutor của bạn cũng trồng được." },
  { q: "Game có hợp với học sinh tiểu học, THCS, THPT không?", a: "Có. Học sinh tiểu học và THCS trồng từ vựng sách giáo khoa theo Unit hoặc các chủ đề mức dễ như gia đình, trường học, đồ ăn, động vật. Học sinh THPT ôn ngữ pháp thi THPT (thì, bị động, điều kiện, mệnh đề quan hệ), phát âm kiểu chọn từ gạch chân khác âm và từ vựng B1–B2. Người đi làm có thể dùng chủ đề công việc, công nghệ, du lịch." },
  { q: "Ngoài trồng trọt còn chơi gì khác?", a: "Giao đơn hàng cho khách (có đơn yêu cầu viết câu có từ đã học, AI chấm), nuôi Qilin con và cho nó đi thám hiểm mang về từ mới, xây chuồng nuôi gà, vịt, bò, heo, cừu để thu trứng, sữa và len, chế biến nông sản trong lò bánh, máy ép nước, bếp mứt, trang trí nông trại với hơn 70 món, mặc đồ cho Qilin, thăm nông trại bạn bè và leo bảng vàng." },
  { q: "Học qua game có thật sự nhớ từ lâu không?", a: "Game chỉ có tác dụng khi bạn phải nhớ lại từ chứ không chỉ nhìn đáp án. Ở Qilin Farm, thu hoạch bắt buộc bạn trả lời (chọn từ, nghe chọn nghĩa, gõ lại từ hoặc điền câu) và lịch chờ bám theo nguyên lý lặp lại ngắt quãng — ôn lại đúng lúc sắp quên — nên việc chơi đều mỗi ngày là việc ôn bài thật. Game không thay thế việc luyện nghe, nói, đọc, viết; Lucy Tutor có các bài luyện 4 kỹ năng riêng." },
];

const FEATURES: [string, string][] = [
  ["Đơn hàng khách đặt", "Giao nông sản hoặc viết 1 câu dùng từ đã học (AI chấm); đơn khó dần theo cấp của bạn."],
  ["Qilin con & thám hiểm", "Vuốt ve, cho ăn, thay trang phục; cho đi thám hiểm 15 phút đến 4 giờ để mang về xu và từ vựng mới."],
  ["Chuồng trại", "Xây hoặc mua ngay chuồng gà, vịt, bò, heo, cừu; thu trứng, sữa, len. Gà vịt ra sân ban ngày, tối về chuồng."],
  ["Nhà máy chế biến", "Lò bánh, máy ép nước, bếp mứt, nhà hàng nhỏ biến nông sản thành thành phẩm giá trị cao."],
  ["Trang trí & trang phục", "Hơn 70 món trang trí, cổng nối liền tường rào, xoay đồ; 24 món trang phục cho Qilin."],
  ["Bạn bè & bảng vàng", "Thăm nông trại của bạn cùng lớp, thả tim, tặng quà và so thứ hạng thu hoạch."],
  ["Nhiệm vụ & thành tựu", "4 nhiệm vụ mỗi ngày kèm rương quà, 13 chuỗi thành tựu để sưu tầm."],
  ["Ngày đêm & thời tiết thật", "Bật tuỳ chọn thời tiết để trời mưa, nắng, đêm theo đúng vị trí của bạn (toạ độ không gửi về máy chủ)."],
];

export default function Page() {
  return (
    <div className="min-h-screen bg-background">
      <ToolJsonLd name={TITLE} path={PATH} description={DESCRIPTION} crumbs={CRUMBS} faqs={FAQS} image={PHOTOS.farmScene} free={false} />
      <ToolBanner crumbs={CRUMBS} title="Game Nông Trại Học Tiếng Anh: Trồng Từ Vựng, Thu Hoạch Bằng Trí Nhớ"
        subtitle="Mỗi ô đất là một từ vựng, ngữ pháp hoặc phát âm. Cây chín đúng lịch ôn tập SRS, bạn nhớ lại từ để thu hoạch, giao đơn hàng, nuôi rồng Qilin và xây nông trại của riêng mình."
        photo={PHOTOS.qilinRun} highlights={["531 thẻ từ vựng, ngữ pháp, phát âm", "Thêm từ vựng SGK lớp 1–12"]} badges={["Dùng thử miễn phí 3 ngày", "Chơi ngay trên trình duyệt"]}
        actions={
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/auth?role=STUDENT" className="btn-primary lp-shine px-7 py-3.5 text-base text-center">Đăng ký chơi thử miễn phí</Link>
            <Link href="/farm" className="btn-outline px-7 py-3.5 text-base text-center">Đã có tài khoản? Vào nông trại</Link>
          </div>
        } />

      <div id="bat-dau" className="max-w-6xl mx-auto px-4 py-6 sm:py-8 scroll-mt-16">
        <figure className="max-w-4xl">
          <img src={PHOTOS.farmScene.src} alt={PHOTOS.farmScene.alt} width={PHOTOS.farmScene.width} height={PHOTOS.farmScene.height} loading="lazy"
            className="w-full h-auto rounded-2xl border border-line shadow-card" />
          <figcaption className="text-sm text-muted mt-2">Màn hình thật của Nông Trại Qilin: ô đất trồng từ, chuồng trại, vật nuôi và rồng Qilin.</figcaption>
        </figure>

        <section className="mt-10 space-y-4 text-foreground/90 leading-relaxed max-w-4xl">
          <h2 className="ui-section-title text-xl">Nông Trại Qilin – game học từ vựng tiếng Anh kiểu nông trại</h2>
          <p>
            Nếu bạn từng chơi các game nông trại, bạn đã quen với vòng lặp trồng cây, chờ cây lớn, thu hoạch rồi giao hàng. <b>Qilin Farm</b> giữ nguyên vòng lặp đó nhưng
            thay hạt giống bằng <b>từ vựng tiếng Anh</b>, và thay thời gian chờ ngẫu nhiên bằng <b>lịch ôn tập ngắt quãng</b> mà não bộ cần để ghi nhớ lâu. Chơi game mỗi ngày
            cũng chính là ôn từ mỗi ngày, không cần ép bản thân mở flashcard.
          </p>
          <p>
            Đây là game học tiếng Anh online dành cho học sinh tiểu học, THCS, THPT và người đi làm, chơi được trên máy tính, điện thoại và máy tính bảng. Game thuộc hệ sinh thái{" "}
            <Link href="/" className="text-primary font-semibold hover:underline">Lucy Tutor</Link>: từ bạn trồng nằm cùng bộ thẻ ôn tập với phòng Gym từ vựng nên học ở đâu cũng được tính.
          </p>

          <h2 className="ui-section-title text-xl pt-6">Cách chơi: cây là từ vựng, thu hoạch là ôn bài</h2>
          <ol className="list-decimal pl-6 space-y-2">
            <li><b>Chọn hạt giống:</b> chọn từ vựng theo chủ đề, thẻ ngữ pháp, thẻ phát âm, từ vựng sách giáo khoa theo lớp và Unit, hoặc từ đang có trong deck ôn tập của bạn.</li>
            <li><b>Trồng và chờ:</b> từ mới chín sau 10 phút. Những lần sau, thời gian chờ bằng khoảng cách tới lần ôn kế tiếp mà thuật toán SM-2 tính cho đúng từ đó.</li>
            <li><b>Thu hoạch bằng trí nhớ:</b> khi cây chín, bạn trả lời câu hỏi: chọn từ theo nghĩa, nghe rồi chọn nghĩa, gõ lại từ hoặc điền vào câu ví dụ. Đúng thì nhận xu, kinh nghiệm và nông sản; sai thì cây héo, mọc lại sau 10 phút để học lại.</li>
            <li><b>Giao hàng và mở rộng:</b> dùng nông sản giao đơn cho khách, chế biến thành thành phẩm, mua thêm ô đất, xây chuồng trại và trang trí.</li>
            <li><b>Rút ngắn thời gian bằng cách học thêm:</b> Ôn sớm một từ chưa tới hạn hoặc Tưới nước bằng cách gõ lại một từ đã học. Xu và kim cương không mua được thời gian chờ, để việc ôn bài luôn là thật.</li>
          </ol>

          <h2 className="ui-section-title text-xl pt-6">Vì sao trồng từ vựng giúp nhớ lâu hơn?</h2>
          <p>
            <b>Lặp lại ngắt quãng (spaced repetition – SRS)</b> là phương pháp ôn lại kiến thức đúng vào lúc bạn sắp quên, với khoảng cách giữa các lần ôn tăng dần. Các công cụ
            như Anki hay Quizlet đều dựa trên nguyên lý này. Điểm khó của SRS là phải nhớ mở ứng dụng đúng ngày. Qilin Farm biến lịch ôn thành cây đang lớn: cây chín nghĩa là
            từ đó đến lúc cần ôn, bạn thấy ngay trên nông trại và có động lực quay lại.
          </p>
          <p>
            Thu hoạch luôn yêu cầu bạn <b>chủ động nhớ lại</b> từ (chọn, gõ, điền câu) thay vì chỉ đọc lại đáp án, và từ sai sẽ quay về đầu chu kỳ. Chu kỳ càng dài thì
            phần thưởng càng lớn (cây chờ 1 ngày thưởng ×1,8; chờ 7 ngày ×3,2), nên từ bạn nhớ càng chắc càng có lợi. Game là công cụ hỗ trợ ôn đều mỗi ngày; để tiến bộ
            toàn diện bạn vẫn nên luyện thêm nghe, nói, đọc, viết.
          </p>

          <h2 className="ui-section-title text-xl pt-6">Kho kiến thức trong game</h2>
          <div className="overflow-x-auto">
            <table className="ui-table w-full text-sm">
              <thead><tr><th>Loại hạt giống</th><th>Quy mô</th><th>Nội dung</th></tr></thead>
              <tbody>
                <tr><td>Từ vựng</td><td>20 chủ đề · 360 từ</td><td>Gia đình, trường học, đồ ăn, du lịch, công việc, sức khoẻ, môi trường, công nghệ, thể thao, mua sắm, cảm xúc, khoa học… mỗi chủ đề có mức A1–A2, B1 và B2</td></tr>
                <tr><td>Ngữ pháp</td><td>9 bộ · 99 thẻ</td><td>Thì hiện tại, quá khứ và hoàn thành, mạo từ và lượng từ, giới từ, so sánh, câu bị động, câu điều kiện và wish, mệnh đề quan hệ, động từ khuyết thiếu</td></tr>
                <tr><td>Phát âm</td><td>6 bộ · 72 thẻ</td><td>Đuôi -ed, đuôi -s/-es, trọng âm, cặp âm dễ nhầm, phiên âm IPA, chọn từ phát âm khác (dạng đề THPT)</td></tr>
                <tr><td>Sách giáo khoa</td><td>Lớp 1–12</td><td>Từ vựng Global Success theo Unit do giáo viên Lucy Tutor soạn (Unit chưa có sẽ hiện &ldquo;Đang cập nhật&rdquo;)</td></tr>
                <tr><td>Deck của bạn</td><td>Không giới hạn</td><td>Từ giáo viên giao hoặc bạn tự thêm ở phòng Gym từ vựng</td></tr>
              </tbody>
            </table>
          </div>

          <h2 className="ui-section-title text-xl pt-6">Những gì có trong nông trại</h2>
          <ul className="grid gap-3 sm:grid-cols-2 list-none pl-0">
            {FEATURES.map(([t, d]) => (
              <li key={t} className="ui-card p-4">
                <h3 className="font-bold text-primary">{t}</h3>
                <p className="text-sm text-muted mt-1">{d}</p>
              </li>
            ))}
          </ul>

          <h2 className="ui-section-title text-xl pt-6">Qilin Farm hay Qilin Run – chọn game nào?</h2>
          <div className="overflow-x-auto">
            <table className="ui-table w-full text-sm">
              <thead><tr><th></th><th>Nông Trại Qilin (Farm)</th><th><Link href="/game-hoc-tieng-anh" className="text-primary hover:underline">Qilin Run</Link></th></tr></thead>
              <tbody>
                <tr><td>Kiểu chơi</td><td>Game nông trại, chơi từng đợt ngắn mỗi ngày</td><td>Game chạy nhảy 2D, mỗi lượt vài phút</td></tr>
                <tr><td>Mục tiêu học</td><td>Ghi nhớ lâu bằng lịch ôn SRS</td><td>Luyện phản xạ và ôn nhanh một bộ thẻ</td></tr>
                <tr><td>Tài khoản</td><td>Cần tài khoản, dùng thử 3 ngày</td><td>Miễn phí, không cần đăng nhập</td></tr>
                <tr><td>Lưu tiến độ</td><td>Lưu trên tài khoản, dùng được nhiều thiết bị</td><td>Kỷ lục lưu trên trình duyệt</td></tr>
              </tbody>
            </table>
          </div>
          <p>
            Muốn thử ngay không cần đăng ký, hãy vào <Link href="/game-hoc-tieng-anh" className="text-primary font-semibold hover:underline">game học tiếng Anh Qilin Run</Link>.
            Muốn ôn từ đều mỗi ngày và nhớ lâu, hãy trồng từ trong Nông Trại Qilin.
          </p>
        </section>

        <ToolNextSteps links={[
          { href: "/game-hoc-tieng-anh", label: "Game học tiếng Anh Qilin Run", text: "Chạy nhảy cùng rồng Qilin, miễn phí và không cần đăng nhập." },
          { href: "/flashcard-tieng-anh", label: "Flashcard tiếng Anh lớp 1–12", text: "Xem và in bộ từ vựng theo Unit trước khi trồng trong game." },
          { href: "/kiem-tra-trinh-do-tieng-anh", label: "Kiểm tra trình độ tiếng Anh", text: "Biết mình ở mức A1–C1 để chọn hạt giống phù hợp." },
        ]} />
        <ToolFaq faqs={FAQS} />
        <ToolCta text="Trồng từ trong Nông Trại Qilin, ôn từ bằng thẻ SRS, luyện 4 kỹ năng cùng AI và làm đề thi thử THPT có tính giờ." />
      </div>
    </div>
  );
}
