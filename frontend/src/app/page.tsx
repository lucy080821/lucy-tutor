import Link from "next/link";
import { CEFR_LEVELS } from "@/lib/skillPractice";
import JsonLd from "@/components/seo/JsonLd";

// Server component: nội dung tĩnh hoàn toàn (không state) → HTML render sẵn, tốt cho SEO.

/* 4 kỹ năng — nay hiển thị ngay trong lưới luyện tập (mục 3) thay vì tab chuyển đổi. */
const PRACTICE_ITEMS = [
  {
    title: "Reading",
    desc: "Luyện đọc hiểu với passage thực tế từ IELTS, TOEIC và đề thi THPT. AI phân tích điểm yếu theo từng dạng câu hỏi.",
    meta: "Đọc hiểu · Cấp độ A1–C1 · 10 dạng câu hỏi",
    thumb: "/images/thumbs/reading.svg",
    alt: "Minh họa luyện kỹ năng đọc hiểu Tiếng Anh",
    href: "/reading",
  },
  {
    title: "Listening",
    desc: "Bài nghe theo chuẩn IELTS/TOEIC với audio chất lượng cao. Luyện tập nhiều lần, track kết quả theo từng phần.",
    meta: "Nghe hiểu · Giọng UK / US / AUS",
    thumb: "/images/thumbs/listening.svg",
    alt: "Minh họa luyện kỹ năng nghe Tiếng Anh với tai nghe",
    href: "/listening",
  },
  {
    title: "Speaking",
    desc: "Luyện nói với AI phân tích phát âm, fluency và coherence theo tiêu chí IELTS. Ghi âm và nhận phản hồi tức thì.",
    meta: "Hội thoại cùng AI · Tự chọn ngữ cảnh",
    thumb: "/images/thumbs/speaking.svg",
    alt: "Minh họa luyện nói Tiếng Anh cùng AI",
    href: "/conversation",
  },
  {
    title: "Writing",
    desc: "Luyện viết Task 1 và Task 2 IELTS. AI chấm điểm theo 4 tiêu chí: Task Achievement, Coherence, Lexical Resource, Grammar.",
    meta: "AI chấm chi tiết · Lưu lịch sử bài viết",
    thumb: "/images/thumbs/writing.svg",
    alt: "Minh họa luyện viết bài luận Tiếng Anh",
    href: "/writing",
  },
  {
    title: "Đề Thi Thử THPT Quốc Gia",
    desc: "AI sinh đề đúng cấu trúc 5 phần: Ngữ Âm, Ngữ Pháp & Từ Vựng, Giao Tiếp, Đọc Điền Từ, Đọc Hiểu.",
    meta: "Đề ngắn 25 phút · Đề đầy đủ 50 phút",
    thumb: "/images/thumbs/mock-test.svg",
    alt: "Minh họa đề thi thử THPT Quốc Gia môn Tiếng Anh",
    href: "/mock-test",
  },
  {
    title: "IELTS Cambridge",
    desc: "Làm đề Listening, Reading, Writing, Speaking từ bộ sách Cambridge do giáo viên đưa lên, chấm theo band 0–9.",
    meta: "4 kỹ năng · Chấm theo band IELTS",
    thumb: "/images/thumbs/ielts.svg",
    alt: "Minh họa luyện đề IELTS Cambridge",
    href: "/ielts",
  },
  {
    title: "Luyện Ngữ Pháp",
    desc: "Luyện tập ngữ pháp theo chuyên đề, tích hợp ôn tập ngắt quãng để ghi nhớ lâu.",
    meta: "Theo chuyên đề · Tự chấm điểm",
    thumb: "/images/thumbs/grammar.svg",
    alt: "Minh họa luyện ngữ pháp Tiếng Anh theo chuyên đề",
    href: "/grammar-gym",
  },
  {
    title: "Bảng Âm IPA",
    desc: "Tra cứu 44 âm Tiếng Anh theo bảng Adrian Underhill, bấm để nghe và xem cách phát âm.",
    meta: "44 âm · Nguyên âm, nguyên âm đôi, phụ âm",
    thumb: "/images/thumbs/phonetics.svg",
    alt: "Minh họa bảng phiên âm quốc tế IPA",
    href: "/phonetics",
  },
];

/* 6 bước — chỉ mô tả các tính năng có thật trong app. */
const STEPS = [
  {
    num: "01",
    title: "Tạo tài khoản học viên",
    desc: "Nhập mã lớp giáo viên cấp, hoặc học tự do và chọn giáo viên phụ trách — được dùng thử miễn phí 3 ngày.",
  },
  {
    num: "02",
    title: "Đặt mục tiêu điểm số",
    desc: "Khai báo mục tiêu trong phần Cài Đặt để hệ thống so sánh tiến độ và gợi ý việc cần làm tiếp theo.",
  },
  {
    num: "03",
    title: "Luyện 4 kỹ năng theo cấp độ",
    desc: "Chọn cấp độ A1–C1 và mục đích (IELTS hoặc giao tiếp) cho Reading, Listening, Writing, Speaking.",
  },
  {
    num: "04",
    title: "Ôn từ vựng & phát âm",
    desc: "Ôn từ bằng thuật toán SM-2, tự thêm từ của riêng bạn và luyện phát âm chính những từ đó cùng AI.",
  },
  {
    num: "05",
    title: "Làm đề thi thử có tính giờ",
    desc: "Đề thi thử THPT Quốc Gia do AI sinh, đề IELTS Cambridge và bài thi giáo viên giao, chấm điểm tự động.",
  },
  {
    num: "06",
    title: "Theo dõi tiến độ & sửa lỗi",
    desc: "Biểu đồ 4 kỹ năng, Sổ Tay Lỗi Sai và bảng Nhận Định & Gợi Ý Học Tập giúp bạn biết cần ôn gì.",
  },
];

const FEATURES = [
  { title: "AI Phân Tích Điểm Yếu", desc: "Tự động nhận diện lỗi sai theo từng chủ điểm ngữ pháp, từ vựng, gợi ý bài luyện tập phù hợp.", thumb: "/images/thumbs/mistakes.svg", alt: "Minh họa AI phân tích lỗi sai của học viên" },
  { title: "Luyện Phát Âm Cùng AI", desc: "Ghi âm giọng nói, AI so khớp với từ mẫu và chỉ ra lỗi phát âm thường gặp của người Việt.", thumb: "/images/thumbs/pronunciation.svg", alt: "Minh họa luyện phát âm Tiếng Anh bằng ghi âm" },
  { title: "Đề Thi Thử THPT Quốc Gia", desc: "AI tự sinh đề đúng cấu trúc đề thi thật (ngữ âm, ngữ pháp, đọc hiểu...), làm có tính giờ và chấm điểm tự động.", thumb: "/images/thumbs/exam.svg", alt: "Minh họa bài thi thử có tính giờ" },
  { title: "Biểu Đồ Tiến Độ 4 Kỹ Năng", desc: "Dashboard riêng cho từng kỹ năng Reading, Listening, Speaking, Writing với biểu đồ theo dõi theo thời gian.", thumb: "/images/thumbs/study-plan.svg", alt: "Minh họa biểu đồ theo dõi tiến độ học tập" },
  { title: "SRS Vocabulary", desc: "Thuật toán SM-2 lên lịch ôn từ vựng khoa học — tự thêm từ của riêng bạn hoặc ôn từ giáo viên giao.", thumb: "/images/thumbs/vocabulary.svg", alt: "Minh họa thẻ ghi nhớ từ vựng" },
  { title: "Ngân Hàng Câu Hỏi", desc: "Đề thi THPT, IELTS, TOEIC được phân loại rõ ràng. Giáo viên nhập câu hỏi hàng loạt từ file Excel mẫu.", thumb: "/images/thumbs/documents.svg", alt: "Minh họa ngân hàng câu hỏi và tài liệu" },
  { title: "Gamification & Streak", desc: "Tích XP, giữ streak học mỗi ngày, leo bảng xếp hạng lớp học — tạo động lực học tập bền vững.", thumb: "/images/thumbs/lesson.svg", alt: "Minh họa học tập mỗi ngày để giữ chuỗi streak" },
  { title: "Dashboard Giáo Viên Pro", desc: "Quản lý lớp học, điểm danh, học phí, giao đề thi — tất cả trên một nền tảng, không cần bảng tính Excel.", thumb: "/images/thumbs/classroom.svg", alt: "Minh họa lớp học do giáo viên quản lý" },
];

/* Mô tả chung của khung CEFR cho từng cấp — không phải số liệu. */
const LEVEL_DESC: Record<string, string> = {
  A1: "Hiểu và dùng câu đơn giản về bản thân, gia đình, sinh hoạt hằng ngày.",
  A2: "Giao tiếp trong tình huống quen thuộc, mô tả trải nghiệm ngắn.",
  B1: "Xử lý phần lớn tình huống thường gặp, viết đoạn văn liền mạch.",
  B2: "Đọc hiểu văn bản phức tạp, trình bày quan điểm rõ ràng và chi tiết.",
  C1: "Sử dụng ngôn ngữ linh hoạt, hiệu quả cho học tập và công việc.",
};

const TEACHER_FEATURES = [
  "Quản lý lớp học, mã tham gia lớp và thêm học viên thủ công",
  "Điểm danh dạng lưới theo tháng, tính học phí theo buổi hoặc theo tháng",
  "Xuất hóa đơn học phí PDF và báo cáo Excel",
  "Soạn đề thi, nhập câu hỏi hàng loạt từ file Excel mẫu",
  "Studio Luyện Nghe: đưa audio và script lên, gán cho lớp hoặc học viên",
  "Trích xuất đề IELTS Cambridge từ PDF, rà soát rồi giao cho học viên",
  "Kiểm soát gian lận khi làm bài: ghi nhận rời tab, copy/paste",
  "Tổng quan doanh thu, tỷ lệ nộp bài và gợi ý theo dữ liệu lớp",
];

const FAQS = [
  {
    q: "Học viên tự do được dùng thử bao lâu?",
    a: "Học viên đăng ký mà không tham gia lớp nào được dùng thử miễn phí 3 ngày, không cần thẻ tín dụng. Khi đăng ký, bạn chọn một giáo viên phụ trách. Sau thời gian dùng thử, giáo viên phụ trách xác nhận học phí để gia hạn quyền sử dụng thêm 1 tháng; trước khi hết hạn 7 ngày, ứng dụng sẽ hiện thông báo nhắc.",
  },
  {
    q: "Tham gia lớp học bằng mã có gì khác?",
    a: "Khi nhập mã lớp do giáo viên cấp (lúc đăng ký hoặc trong phần Cài Đặt), tài khoản của bạn không còn bị giới hạn thời gian dùng thử. Học phí khi đó được giáo viên quản lý theo lớp qua hệ thống Điểm Danh & Học Phí.",
  },
  {
    q: "Có thể cài Lucy Tutor lên điện thoại không?",
    a: "Có. Lucy Tutor là ứng dụng web cài đặt được (PWA). Trên Android và máy tính, bấm nút \"Cài Đặt Ứng Dụng\" trong trang học viên. Trên iPhone (Safari), chọn Chia sẻ → Thêm vào Màn hình chính.",
  },
  {
    q: "Bài Writing và Speaking được chấm như thế nào?",
    a: "Bài viết và bài nói được AI chấm và nhận xét chi tiết. Với đề IELTS Cambridge, Writing được chấm theo 4 tiêu chí chính thức (Task Achievement/Task Response, Coherence & Cohesion, Lexical Resource, Grammatical Range & Accuracy) và Speaking theo 4 tiêu chí (Fluency & Coherence, Lexical Resource, Grammatical Range & Accuracy, Pronunciation), quy ra band 0–9.",
  },
  {
    q: "Điểm phát âm có chính xác tuyệt đối không?",
    a: "Không. Điểm phát âm là ước lượng dựa trên công nghệ nhận dạng giọng nói tự động: hệ thống chuyển bản ghi âm thành văn bản rồi so khớp với từ/câu mẫu. Đây không phải phân tích âm vị học chính xác, nhưng giúp bạn phát hiện những từ còn phát âm chưa rõ và nhận góp ý sửa lỗi từ AI.",
  },
];

export default function Home() {
  return (
    <div className="flex-1 flex flex-col bg-white">
      <JsonLd />

      {/* ── 1. Hero ── */}
      <section className="bg-white px-4 sm:px-6 pt-10 pb-14 md:pt-14 md:pb-20" aria-labelledby="hero-title">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-12 items-center">
          <div className="space-y-6 text-center lg:text-left">
            <span className="ui-badge uppercase tracking-wide">Nền tảng luyện thi Tiếng Anh toàn diện</span>
            <h1 id="hero-title" className="text-4xl sm:text-5xl lg:text-[3.4rem] font-extrabold tracking-tight leading-tight text-primary">
              Chinh phục Tiếng Anh bằng{" "}
              <span className="relative inline-block">
                <span className="relative z-10">AI thế hệ mới</span>
                <span aria-hidden="true" className="absolute left-0 right-0 bottom-1 h-3 sm:h-4 bg-highlight/40 rounded-sm" />
              </span>
            </h1>
            <p className="text-base sm:text-lg text-muted max-w-xl mx-auto lg:mx-0 leading-relaxed">
              Lộ trình học cá nhân hóa · Luyện 4 kỹ năng Reading, Listening, Speaking, Writing · AI phân tích điểm yếu tức thì · Giáo viên quản lý lớp không cần Excel.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <Link href="/auth?role=STUDENT" className="btn-primary px-8 py-3.5 text-base">
                Dành cho Học Sinh
              </Link>
              <Link href="/auth?role=TEACHER" className="btn-outline px-8 py-3.5 text-base">
                Dành cho Giáo Viên
              </Link>
            </div>
            {/* Trial callout — ưu đãi thật, không phải số liệu dàn dựng */}
            <p className="flex flex-wrap items-center justify-center lg:justify-start gap-2 text-sm text-muted">
              <span className="ui-badge-new">Dùng thử miễn phí 3 ngày</span>
              <span aria-hidden="true">·</span>
              <span>Không cần thẻ tín dụng</span>
            </p>
          </div>

          <div className="relative mx-auto w-full max-w-xl">
            <div className="rounded-3xl bg-primary-soft p-4 sm:p-6">
              <img
                src="/images/illustrations/hero-student.svg"
                alt="Học sinh luyện thi Tiếng Anh trên máy tính với tai nghe và sách"
                width={800}
                height={600}
                loading="eager"
                className="w-full h-auto"
              />
            </div>
            {/* Floating cards — chỉ nêu tính năng có thật */}
            <div className="absolute -left-2 sm:-left-6 top-6 sm:top-10 bg-white rounded-2xl shadow-card border border-line px-4 py-3 max-w-[190px]">
              <p className="text-xs text-muted">Luyện theo cấp độ</p>
              <p className="text-sm font-bold text-primary">CEFR A1 – C1</p>
            </div>
            <div className="absolute -right-2 sm:-right-6 top-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-card border border-line px-4 py-3 max-w-[190px] hidden sm:block">
              <p className="text-xs text-muted">Chấm Writing & Speaking</p>
              <p className="text-sm font-bold text-primary">Tiêu chí IELTS</p>
            </div>
            <div className="absolute left-4 sm:left-10 -bottom-5 bg-white rounded-2xl shadow-card border border-line px-4 py-3 max-w-[210px]">
              <p className="text-xs text-muted">Ôn từ vựng khoa học</p>
              <p className="text-sm font-bold text-primary">SRS · Thuật toán SM-2</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. 6 bước ── */}
      <section className="bg-background px-4 sm:px-6 py-14" aria-labelledby="steps-title">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10 space-y-3">
            <h2 id="steps-title" className="ui-section-title text-center text-2xl md:text-3xl font-extrabold">6 bước chinh phục Tiếng Anh cùng Lucy Tutor</h2>
            <p className="text-muted max-w-2xl mx-auto">Từ lúc tạo tài khoản đến khi theo dõi tiến bộ — mỗi bước đều gắn với một công cụ có sẵn trong ứng dụng.</p>
          </div>
          <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
            {STEPS.map((step) => (
              <li key={step.num} className="ui-card ui-card-hover p-6 h-full">
                <span className="block text-4xl font-black text-primary/20 leading-none mb-3">{step.num}</span>
                <h3 className="text-lg font-bold text-primary mb-2">{step.title}</h3>
                <p className="text-muted text-sm leading-relaxed">{step.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── 3. Luyện tập ── */}
      <section className="bg-white px-4 sm:px-6 py-14" aria-labelledby="practice-title">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10 space-y-3">
            <h2 id="practice-title" className="ui-section-title text-center text-2xl md:text-3xl font-extrabold">Luyện tập 4 kỹ năng & đề thi thử</h2>
            <p className="text-muted max-w-2xl mx-auto">Mỗi kỹ năng được track độc lập với lộ trình, bài tập và báo cáo riêng biệt.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6">
            {PRACTICE_ITEMS.map((item) => (
              <article key={item.href} className="ui-card ui-card-hover overflow-hidden flex flex-col">
                <div className="aspect-video bg-primary-soft">
                  <img src={item.thumb} alt={item.alt} width={640} height={360} loading="lazy" className="w-full h-full object-cover" />
                </div>
                <div className="p-5 flex flex-col flex-1">
                  <h3 className="font-bold text-primary text-base mb-1">{item.title}</h3>
                  <p className="text-xs text-muted mb-2">{item.meta}</p>
                  <p className="text-sm text-foreground/80 leading-relaxed mb-4 flex-1">{item.desc}</p>
                  <Link href={item.href} className="btn-primary self-start px-5 py-2 text-sm" aria-label={`Làm ngay: ${item.title}`}>
                    Làm ngay
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4. Lộ trình cấp độ CEFR ── */}
      <section className="bg-background px-4 sm:px-6 py-14" aria-labelledby="levels-title">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10 space-y-3">
            <h2 id="levels-title" className="ui-section-title text-center text-2xl md:text-3xl font-extrabold">Lộ trình theo cấp độ A1 – C1</h2>
            <p className="text-muted max-w-2xl mx-auto">Reading, Writing, Speaking và Listening đều cho phép chọn cấp độ theo khung CEFR, để bài luyện luôn vừa sức với bạn.</p>
          </div>
          <ol className="relative grid grid-cols-1 md:grid-cols-5 gap-5">
            <span aria-hidden="true" className="hidden md:block absolute top-7 left-[10%] right-[10%] h-0.5 bg-primary/20" />
            {CEFR_LEVELS.map((lvl, i) => {
              const [code, name] = lvl.label.split(" — ");
              return (
                <li key={lvl.value} className="relative flex md:flex-col items-start md:items-center gap-4 md:gap-3 md:text-center">
                  <span
                    className={`relative z-10 shrink-0 w-14 h-14 rounded-full flex items-center justify-center font-extrabold text-lg border-2 border-primary ${
                      i === CEFR_LEVELS.length - 1 ? "bg-primary text-white" : "bg-white text-primary"
                    }`}
                  >
                    {code}
                  </span>
                  <div>
                    <h3 className="font-bold text-primary">{name}</h3>
                    <p className="text-sm text-muted leading-relaxed mt-1">{LEVEL_DESC[lvl.value]}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* ── Tính năng nổi bật ── */}
      <section className="bg-white px-4 sm:px-6 py-14" aria-labelledby="features-title">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10 space-y-3">
            <h2 id="features-title" className="ui-section-title text-center text-2xl md:text-3xl font-extrabold">Mọi thứ bạn cần để bứt phá</h2>
            <p className="text-muted max-w-2xl mx-auto">8 tính năng nổi bật dành cho học viên và giáo viên.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6">
            {FEATURES.map((f) => (
              <article key={f.title} className="ui-card ui-card-hover overflow-hidden">
                <div className="aspect-video bg-primary-soft">
                  <img src={f.thumb} alt={f.alt} width={640} height={360} loading="lazy" className="w-full h-full object-cover" />
                </div>
                <div className="p-5">
                  <h3 className="font-bold text-primary text-base mb-2">{f.title}</h3>
                  <p className="text-muted text-sm leading-relaxed">{f.desc}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. Dành cho giáo viên ── */}
      <section className="bg-background px-4 sm:px-6 py-14" aria-labelledby="teacher-title">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div className="order-2 lg:order-1">
            <img
              src="/images/illustrations/teacher-dashboard.svg"
              alt="Giáo viên theo dõi biểu đồ và quản lý lớp học trên dashboard"
              width={800}
              height={600}
              loading="lazy"
              className="w-full h-auto max-w-xl mx-auto"
            />
          </div>
          <div className="order-1 lg:order-2 space-y-5">
            <h2 id="teacher-title" className="ui-section-title text-2xl md:text-3xl font-extrabold">Dashboard dành cho Giáo Viên</h2>
            <p className="text-muted leading-relaxed">
              Quản lý lớp học, điểm danh, học phí, giao đề thi — tất cả trên một nền tảng, không cần bảng tính Excel.
            </p>
            <ul className="space-y-3">
              {TEACHER_FEATURES.map((t) => (
                <li key={t} className="flex items-start gap-3 text-foreground">
                  <svg aria-hidden="true" className="w-5 h-5 mt-0.5 shrink-0 text-primary" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  <span className="text-sm sm:text-base">{t}</span>
                </li>
              ))}
            </ul>
            <Link href="/auth?role=TEACHER" className="btn-primary px-7 py-3 text-base">
              Đăng nhập Giáo Viên
            </Link>
          </div>
        </div>
      </section>

      {/* ── 6. FAQ ── */}
      <section className="bg-white px-4 sm:px-6 py-14" aria-labelledby="faq-title">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-10 items-start">
          <div className="space-y-4 text-center lg:text-left">
            <h2 id="faq-title" className="ui-section-title text-2xl md:text-3xl font-extrabold inline-block lg:block">Câu hỏi thường gặp</h2>
            <p className="text-muted">Những thắc mắc phổ biến về tài khoản, dùng thử và cách chấm điểm.</p>
            <img
              src="/images/illustrations/faq.svg"
              alt="Minh họa hỏi đáp và hỗ trợ người học"
              width={800}
              height={600}
              loading="lazy"
              className="w-full h-auto max-w-sm mx-auto lg:mx-0 hidden sm:block"
            />
          </div>
          <div className="space-y-3">
            {FAQS.map((f, i) => (
              <details key={f.q} className="group ui-card px-5 py-1" open={i === 0}>
                <summary className="flex items-center justify-between gap-4 py-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                  <h3 className="font-bold text-primary text-base">{f.q}</h3>
                  <svg aria-hidden="true" className="w-5 h-5 shrink-0 text-primary transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </summary>
                <p className="pb-4 text-sm sm:text-base text-muted leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── 7. Liên hệ / CTA ── */}
      <section className="bg-background px-4 sm:px-6 py-14" aria-labelledby="cta-title">
        <div className="max-w-7xl mx-auto ui-card p-6 sm:p-10 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div className="space-y-5 text-center md:text-left">
            <h2 id="cta-title" className="ui-section-title text-2xl md:text-3xl font-extrabold inline-block md:block">Bắt đầu học ngay hôm nay</h2>
            <p className="text-muted text-base sm:text-lg">Không cần thẻ tín dụng. Dùng thử miễn phí 3 ngày.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
              <Link href="/auth?role=STUDENT" className="btn-primary px-7 py-3 text-base">
                Học viên đăng ký
              </Link>
              <Link href="/auth?role=TEACHER" className="btn-outline px-7 py-3 text-base">
                Dành cho Giáo Viên
              </Link>
            </div>
            <p className="text-sm text-muted">
              Cần hỗ trợ? Liên hệ <a href="mailto:lucy@lucytutor.vn" className="font-semibold text-primary hover:underline">lucy@lucytutor.vn</a>
            </p>
          </div>
          <img
            src="/images/illustrations/contact.svg"
            alt="Minh họa liên hệ và trò chuyện với Lucy Tutor"
            width={800}
            height={600}
            loading="lazy"
            className="w-full h-auto max-w-md mx-auto"
          />
        </div>
      </section>

      {/* ── 8. Footer ── */}
      <footer className="bg-white border-t border-line text-muted pt-12 pb-8 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 pb-8 border-b border-line">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center text-white font-black text-sm">L</div>
                <span className="text-lg font-black text-primary">LUCY<span className="text-muted">TUTOR</span></span>
              </div>
              <p className="text-sm text-muted leading-relaxed">
                Nền tảng luyện thi Tiếng Anh thông minh dành cho học viên và giáo viên Việt Nam.
              </p>
            </div>
            <nav aria-label="Luyện tập kỹ năng">
              <h3 className="text-primary font-bold mb-3 text-sm uppercase tracking-wide">Luyện kỹ năng</h3>
              <ul className="space-y-2 text-sm">
                <li><Link href="/reading" className="hover:text-primary transition-colors">Luyện Đọc Hiểu</Link></li>
                <li><Link href="/listening" className="hover:text-primary transition-colors">Luyện Nghe</Link></li>
                <li><Link href="/writing" className="hover:text-primary transition-colors">Luyện Viết</Link></li>
                <li><Link href="/conversation" className="hover:text-primary transition-colors">Luyện Nói Cùng AI</Link></li>
                <li><Link href="/pronunciation" className="hover:text-primary transition-colors">Luyện Phát Âm</Link></li>
              </ul>
            </nav>
            <nav aria-label="Đề thi và công cụ">
              <h3 className="text-primary font-bold mb-3 text-sm uppercase tracking-wide">Học viên</h3>
              <ul className="space-y-2 text-sm">
                <li><Link href="/auth?role=STUDENT" className="hover:text-primary transition-colors">Đăng ký miễn phí</Link></li>
                <li><Link href="/mock-test" className="hover:text-primary transition-colors">Đề Thi Thử THPT Quốc Gia</Link></li>
                <li><Link href="/ielts" className="hover:text-primary transition-colors">IELTS Cambridge</Link></li>
                <li><Link href="/exam" className="hover:text-primary transition-colors">Demo bài thi</Link></li>
                <li><Link href="/grammar-gym" className="hover:text-primary transition-colors">Luyện ngữ pháp</Link></li>
                <li><Link href="/gym" className="hover:text-primary transition-colors">Phòng Gym Từ Vựng</Link></li>
                <li><Link href="/phonetics" className="hover:text-primary transition-colors">Bảng Âm IPA</Link></li>
              </ul>
            </nav>
            <nav aria-label="Dành cho giáo viên">
              <h3 className="text-primary font-bold mb-3 text-sm uppercase tracking-wide">Giáo viên</h3>
              <ul className="space-y-2 text-sm">
                <li><Link href="/auth?role=TEACHER" className="hover:text-primary transition-colors">Đăng nhập Giáo Viên</Link></li>
                <li><a href="mailto:lucy@lucytutor.vn" className="hover:text-primary transition-colors">Hỗ trợ: lucy@lucytutor.vn</a></li>
              </ul>
            </nav>
          </div>
          <div className="pt-6 flex flex-col md:flex-row justify-between items-center gap-3 text-xs text-muted/80 text-center">
            <span>© 2026 Lucy Tutor. Đã đăng ký bản quyền.</span>
            <span>Hệ thống luyện thi Tiếng Anh thông minh · Powered by AI</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
