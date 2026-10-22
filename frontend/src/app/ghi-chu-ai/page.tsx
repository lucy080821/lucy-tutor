import Link from "next/link";
import { pageMetadata, SITE_URL, SITE_NAME } from "@/lib/seo";
import { ToolFaq, type Faq } from "@/components/tools/ToolPage";
import { NotesMockup } from "@/components/landing/NotesMockup";
import ScrollReveal from "@/components/landing/ScrollReveal";

// Trang giới thiệu công khai (được index) cho tính năng Ghi chú. /notes dùng miễn phí không cần đăng nhập (khách: ghi chú
// lưu trên trình duyệt) nhưng là giao diện app nên vẫn noindex — trang này mới là trang đích từ Google.
// Từ khoá chính: "app ghi chú có AI" / "ghi chú AI" (+ "ghi âm bài giảng thành văn bản", "tạo flashcard từ ghi chú")
// Từ khoá phụ: ứng dụng ghi chú online, app ghi chú miễn phí, ghi âm thành văn bản tiếng việt, app ghi chép bài giảng,
// cách ghi chép cornell, ghi chú học tiếng anh, sổ tay từ vựng tiếng anh online, app ghi chú cho học sinh
// ⚠️ Danh sách từ khoá là giả thuyết theo cách người dùng tìm kiếm — kiểm tra lại bằng Search Console sau 4–8 tuần
// (tab SEO Performance ở /administrator) rồi chỉnh tiêu đề/H2 theo truy vấn thật.
const PATH = "/ghi-chu-ai";
const TITLE = "Ghi Chú AI: Ghi Âm Thành Ghi Chú, Tự Tạo Flashcard";
const DESCRIPTION =
  "App ghi chú online miễn phí có AI, không cần đăng nhập: ghi âm bài giảng thành ghi chú, tự tạo flashcard, quiz và hỏi lại sổ ghi chú của bạn.";
const APP = "/notes";
const SIGNUP = "/auth?role=STUDENT&next=/notes";

export const metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: PATH,
  image: { src: "/images/photos/home/ghi-chu-ai-ghi-am-flashcard.webp", alt: "Giao diện Lucy Notes: ghi âm thành ghi chú có mốc thời gian, việc cần làm, hỏi sổ ghi chú", width: 960, height: 540 },
  keywords: [
    "app ghi chú miễn phí không cần đăng nhập", "ghi chú online miễn phí",
    "app ghi chú có ai", "ghi chú ai", "ứng dụng ghi chú online", "app ghi chú miễn phí", "ghi âm bài giảng thành văn bản",
    "ghi âm thành văn bản tiếng việt", "tạo flashcard từ ghi chú", "app ghi chép bài giảng", "cách ghi chép cornell",
    "ghi chú học tiếng anh", "sổ tay từ vựng tiếng anh online", "app ghi chú cho học sinh",
  ],
});

const FAQS: Faq[] = [
  { q: "Lucy Notes có miễn phí không? Có cần đăng nhập không?", a: "Miễn phí và không cần đăng nhập: mở trang Ghi chú là dùng được ngay, ghi chú được lưu trên trình duyệt của bạn. AI cũng dùng được khi chưa đăng nhập (10 lượt AI và 1 lượt chuyển ghi âm mỗi ngày). Chỉ cần đăng nhập khi muốn nối ghi chú với dữ liệu trong Lucy Tutor: đồng bộ nhiều thiết bị, đưa từ vựng vào deck ôn tập, liên kết bài học/đề thi của lớp, gửi trang cho giáo viên góp ý." },
  { q: "Ghi chú khi chưa đăng nhập được lưu ở đâu?", a: "Trên chính trình duyệt bạn đang dùng (bộ nhớ IndexedDB), không gửi lên máy chủ trừ khi bạn bấm dùng tính năng AI. Nếu xoá dữ liệu trình duyệt hoặc dùng chế độ ẩn danh thì ghi chú có thể mất — hãy xuất file định kỳ hoặc đăng nhập. Khi đăng nhập, bạn có thể đưa toàn bộ ghi chú trên máy lên tài khoản chỉ với 1 lần bấm." },
  { q: "Ghi âm bài giảng thành ghi chú hoạt động thế nào?", a: "Bạn bấm ghi âm ngay trong trang (hoặc chọn file ghi âm có sẵn), tối đa 30 phút mỗi bản. AI chép lời tiếng Việt hoặc tiếng Anh, chia thành ý chính, từ vựng, việc cần làm và câu hỏi cần làm rõ. Mỗi ý có mốc thời gian — bấm vào là nghe lại đúng đoạn đó. AI có thể nghe nhầm tên riêng hoặc thuật ngữ hiếm, nên hãy đối chiếu với bản ghi khi cần." },
  { q: "“Hỏi sổ ghi chú” có tự bịa câu trả lời không?", a: "AI chỉ trả lời dựa trên các đoạn tìm được trong ghi chú của chính bạn (gồm cả chữ trong ảnh và bản chép lời ghi âm), kèm nguồn để bấm mở đúng trang. Nếu ghi chú không có thông tin, AI sẽ nói là không tìm thấy thay vì tự trả lời." },
  { q: "Giáo viên có đọc được ghi chú của tôi không?", a: "Không. Mọi trang mặc định là riêng tư. Giáo viên chỉ đọc được trang khi bạn chủ động bấm “Gửi cho giáo viên” để nhờ góp ý, và bạn có thể ngừng chia sẻ bất cứ lúc nào. Liên kết một trang với bài học hay đề thi của lớp chỉ để bạn mở nhanh nội dung gốc, không làm lộ trang." },
  { q: "AI có đọc toàn bộ ghi chú của tôi không?", a: "Nội dung chỉ được gửi cho AI khi bạn bấm dùng một tính năng AI (tóm tắt, tạo flashcard, hỏi sổ ghi chú…). Bạn có thể bật “Tắt AI cho sổ này” với từng sổ tay — nội dung sổ đó sẽ không bao giờ được gửi cho AI, kể cả khi hỏi sổ ghi chú." },
  { q: "Có giới hạn số ghi chú hay dung lượng không?", a: "Khi chưa đăng nhập: 200MB trên trình duyệt, 10 lượt AI và 1 lượt chuyển ghi âm mỗi ngày. Có tài khoản: tối đa 5.000 trang, 200MB file đính kèm (ảnh được nén tự động), 40 lượt AI chữ và 6 lượt chuyển ghi âm mỗi ngày. Lượt AI bị lỗi không bị tính." },
  { q: "Tôi có lấy dữ liệu ra được không?", a: "Có. Mỗi trang tải được dạng Markdown hoặc PDF, và nút “Xuất toàn bộ” tải về 1 file ZIP gồm tất cả trang dạng Markdown theo thư mục sổ tay/mục cùng file dữ liệu gốc JSON." },
  { q: "Dùng trên điện thoại được không?", a: "Được. Giao diện tự chuyển sang 1 cột trên điện thoại, chụp vở bằng camera và ghi âm trực tiếp trên trình duyệt. Bạn có thể cài Lucy Tutor lên màn hình chính như một ứng dụng." },
];

const POWER = [
  {
    id: "ghi-am", title: "Ghi âm bài giảng, nhận ngay ghi chú có mốc thời gian",
    lead: "Không cần vừa nghe vừa chép. Bấm ghi âm, tập trung vào bài giảng — AI lo phần ghi chép.",
    points: [
      "AI chép lời tiếng Việt và tiếng Anh, rồi sắp xếp thành ý chính theo kiểu bạn chọn: ghi chép bài giảng, biên bản họp, Cornell hoặc dàn ý.",
      "Mỗi ý có mốc thời gian dạng 07:40 — bấm vào là phát lại đúng đoạn giảng viên nói, kèm bản chép lời bấm từng câu để nghe lại.",
      "Tự tách từ vựng mới (với bài giảng tiếng Anh), việc cần làm được nhắc tới và câu hỏi còn bỏ ngỏ.",
      "Lời trong bản ghi âm được đưa vào tìm kiếm: gõ một từ là thấy cả những gì bạn chỉ nghe chứ chưa viết.",
    ],
  },
  {
    id: "flashcard", title: "Ghi chú tự biến thành flashcard và bài kiểm tra",
    lead: "Ghi chép xong là có ngay bộ ôn tập — không phải chép lại từng thẻ.",
    points: [
      "AI rút từ vựng và khái niệm trong trang thành flashcard; bạn tick chọn rồi đưa vào deck ôn tập, lịch ôn tự động theo thuật toán lặp lại ngắt quãng (SM-2) ở Phòng Gym Từ Vựng.",
      "Quiz 8 câu chỉ dựa trên chính ghi chú của bạn (trắc nghiệm, đúng/sai, điền từ), chấm ngay và giải thích từng câu.",
      "Ôn kiểu Feynman: AI hỏi bạn giải thích lại một ý bằng lời của mình, rồi chỉ ra chỗ hiểu sai hoặc còn thiếu.",
      "Bật “Ôn lại trang này” để được nhắc đọc lại sau 1, 3, 7, 14 và 30 ngày — đúng lúc trí nhớ bắt đầu phai.",
    ],
  },
  {
    id: "hoi-so", title: "Hỏi lại chính sổ ghi chú của bạn",
    lead: "Ghi nhiều đến mấy cũng không sợ quên mình đã viết ở đâu.",
    points: [
      "Hỏi bằng câu tự nhiên như “Thầy dặn gì về bài nộp tuần này?” hoặc “Khi nào dùng since và for?”.",
      "Câu trả lời chỉ dựa trên ghi chú của bạn, mỗi ý kèm nguồn [1], [2] — bấm để mở đúng trang gốc.",
      "Tìm được cả trong chữ của ảnh chụp vở và bản chép lời ghi âm.",
      "Không có trong ghi chú thì AI nói là không có — không tự bịa.",
    ],
  },
];

const FULL = [
  ["Sổ tay → Mục → Trang con", "Sắp xếp như sổ thật: nhiều sổ tay, mỗi sổ chia mục có màu, trang lồng 3 cấp, kéo thả đổi thứ tự."],
  ["Soạn thảo theo khối", "Gõ / để chèn tiêu đề, checklist, bảng, khối code, ghi chú nổi bật; gõ [[ để liên kết sang trang khác."],
  ["Việc cần làm có hạn chót", "Checklist trong mọi trang gom về một chỗ: quá hạn, hôm nay, sắp tới. AI hiểu “thứ 6 tuần sau”, “mai 8h tối”."],
  ["Chụp vở, bảng trắng", "Chụp ảnh → nhận dạng chữ ngay trên máy → AI sửa lỗi nhận dạng, khôi phục dấu tiếng Việt và trình bày lại."],
  ["Tìm kiếm không dấu", "Gõ “hien tai hoan thanh” vẫn ra “hiện tại hoàn thành”; lọc theo thẻ, có ảnh, có ghi âm, có việc cần làm."],
  ["Lưu tự động, không mất bài", "Lưu mỗi khi bạn ngừng gõ, giữ bản nháp trong máy khi mất mạng, báo khi trang bị sửa ở thiết bị khác."],
  ["Lịch sử phiên bản", "Tự chụp lại trang khi bạn sửa, giữ 30 bản gần nhất — xem lại và khôi phục bản cũ bất cứ lúc nào."],
  ["Trợ lý viết", "Tóm tắt, lập dàn ý, viết lại gọn hơn, dịch Anh ↔ Việt, chuyển thành bảng — xem trước rồi mới chèn."],
  ["Học tiếng Anh ngay trong ghi chú", "Bôi đen để tra nghĩa theo ngữ cảnh và nghe phát âm; sửa lỗi nhật ký tiếng Anh, theo dõi lỗi hay lặp lại."],
  ["Sơ đồ tư duy", "AI vẽ sơ đồ tư duy từ nội dung trang, sửa nhãn dễ dàng — hợp để ôn bài trước kỳ thi."],
  ["Mẫu trang có sẵn", "Cornell, ghi chép bài giảng, biên bản họp, kế hoạch tuần, từ vựng theo Unit, IELTS Writing, nhật ký…"],
  ["Xuất dữ liệu tự do", "Tải từng trang dạng Markdown/PDF, hoặc xuất toàn bộ thành 1 file ZIP. Dữ liệu là của bạn."],
];

function JsonLd() {
  const url = `${SITE_URL}${PATH}`;
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication", name: "Lucy Notes — Ghi chú AI", url, description: DESCRIPTION,
        applicationCategory: "ProductivityApplication", operatingSystem: "Web", inLanguage: "vi-VN",
        isAccessibleForFree: true, offers: { "@type": "Offer", price: "0", priceCurrency: "VND" },
        image: `${SITE_URL}/images/photos/home/ghi-chu-ai-ghi-am-flashcard.webp`,
        featureList: POWER.map((p) => p.title).concat(FULL.map(([t]) => t)),
        provider: { "@type": "EducationalOrganization", name: SITE_NAME, url: SITE_URL },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [{ name: "Trang chủ", href: "" }, { name: "Ghi chú AI", href: PATH }].map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: `${SITE_URL}${c.href}` })),
      },
      { "@type": "FAQPage", mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
    ],
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

export default function Page() {
  return (
    <div className="min-h-screen bg-background">
      <JsonLd />
      <ScrollReveal />
      <section className="relative overflow-hidden bg-primary-soft border-b border-line">
        <div className="max-w-6xl mx-auto px-4 pt-6 sm:pt-10 pb-14 sm:pb-20 grid md:grid-cols-[1.05fr_1fr] gap-10 items-center">
          <div className="min-w-0">
            <nav aria-label="Breadcrumb" className="text-sm text-muted">
              <ol className="flex flex-wrap items-center gap-1">
                <li><Link href="/" className="hover:text-primary">Trang chủ</Link></li>
                <li className="flex items-center gap-1"><span aria-hidden="true">/</span><span aria-current="page" className="text-foreground">Ghi chú AI</span></li>
              </ol>
            </nav>
            <p className="lp-enter mt-5 flex flex-wrap gap-2"><span className="ui-badge-new">Miễn phí</span><span className="ui-badge bg-white">Không cần đăng nhập</span></p>
            <h1 className="lp-enter mt-3 text-3xl sm:text-4xl lg:text-[2.75rem] font-extrabold tracking-tight leading-tight text-primary">
              Ghi Chú AI: Ghi Âm Thành Ghi Chú, Tự Tạo Flashcard, Hỏi Lại Sổ Ghi Chú
            </h1>
            <p className="lp-enter mt-4 text-base sm:text-lg text-muted leading-relaxed max-w-xl">
              Lucy Notes là sổ ghi chú online cho mọi thứ — bài giảng, công việc, kế hoạch, nhật ký — có AI giúp ghi chép, sắp xếp và biến ghi chú thành bài ôn tập.
            </p>
            <div className="lp-enter mt-6 flex flex-col sm:flex-row gap-3">
              <Link href={APP} className="btn-primary lp-shine px-7 py-3.5 text-base text-center">Mở Ghi chú ngay — miễn phí</Link>
              <Link href={SIGNUP} className="btn-outline px-7 py-3.5 text-base text-center bg-white">Đăng nhập để đồng bộ</Link>
            </div>
            <p className="mt-4 text-sm text-muted">Không cần tài khoản: ghi chú lưu ngay trên trình duyệt. Đăng nhập khi muốn đồng bộ, đưa từ vựng vào deck ôn tập hay liên kết bài học của lớp.</p>
          </div>
          <div className="lp-enter-zoom pb-6"><NotesMockup /></div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 py-12 sm:py-16 space-y-16">
        <section aria-labelledby="power-title">
          <h2 id="power-title" className="ui-section-title text-center text-2xl md:text-3xl font-extrabold">3 tính năng khác biệt nhất</h2>
          <p className="text-center text-muted mt-3 max-w-2xl mx-auto">Không chỉ là chỗ để viết: ghi chú trong Lucy Notes tự làm việc cho bạn.</p>
          <div className="mt-10 space-y-6">
            {POWER.map((p, i) => (
              <div key={p.id} data-reveal={i % 2 ? "right" : "left"}>
                <article id={p.id} className="ui-card p-6 sm:p-8 grid lg:grid-cols-[1fr_1.2fr] gap-6 scroll-mt-20">
                  <div>
                    <p className="text-sm font-bold text-highlight">0{i + 1}</p>
                    <h3 className="text-xl sm:text-2xl font-extrabold text-primary mt-1 leading-snug">{p.title}</h3>
                    <p className="text-muted mt-3">{p.lead}</p>
                  </div>
                  <ul className="space-y-3">
                    {p.points.map((pt) => (
                      <li key={pt} className="flex gap-3 text-foreground/90 leading-relaxed">
                        <span aria-hidden="true" className="mt-2 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />{pt}
                      </li>
                    ))}
                  </ul>
                </article>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="full-title">
          <h2 id="full-title" className="ui-section-title text-center text-2xl md:text-3xl font-extrabold">Đầy đủ như một app ghi chú chuyên nghiệp</h2>
          <ul className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FULL.map(([t, d]) => (
              <li key={t} data-reveal="zoom"><div className="ui-card p-5 h-full"><h3 className="font-bold text-primary">{t}</h3><p className="text-sm text-muted mt-1.5 leading-relaxed">{d}</p></div></li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="class-title" className="grid lg:grid-cols-2 gap-6">
          <p className="lg:col-span-2 text-center text-muted -mb-2">Các tính năng dưới đây cần đăng nhập vì nối ghi chú với dữ liệu lớp học trong Lucy Tutor.</p>
          <div className="ui-card p-6 sm:p-8" data-reveal="left">
            <h2 id="class-title" className="text-xl sm:text-2xl font-extrabold text-primary">Dành cho học viên trong lớp</h2>
            <ul className="mt-4 space-y-2.5 text-foreground/90 leading-relaxed list-disc pl-5">
              <li>Liên kết trang ghi chú với bài học, đề thi, tài liệu của lớp — mở bài học là thấy ngay ghi chú của mình cho bài đó.</li>
              <li>Gửi dàn ý, bài viết, nhật ký tiếng Anh cho giáo viên để nhận góp ý ngay trong trang.</li>
              <li>Xem ghi chú bài giảng giáo viên chia sẻ cho lớp, tạo bản sao để ghi thêm.</li>
            </ul>
          </div>
          <div className="ui-card p-6 sm:p-8" data-reveal="right">
            <h2 className="text-xl sm:text-2xl font-extrabold text-primary">Dành cho giáo viên</h2>
            <ul className="mt-4 space-y-2.5 text-foreground/90 leading-relaxed list-disc pl-5">
              <li>Soạn giáo án trong ghi chú rồi để AI chuyển thành Bài học (kèm từ vựng) hoặc file đề thi đúng mẫu nhập Excel.</li>
              <li>Ghi chú riêng về từng học viên (luôn riêng tư) — AI gộp với điểm số, chuyên cần để soạn nhận xét gửi phụ huynh.</li>
              <li>Tìm lỗ hổng kiến thức chung của lớp từ các trang học viên gửi (ẩn danh), gợi ý nội dung buổi sau.</li>
            </ul>
          </div>
        </section>

        <section aria-labelledby="cornell-title" className="ui-card p-6 sm:p-8 text-foreground/90 leading-relaxed" data-reveal="">
          <h2 id="cornell-title" className="ui-section-title text-xl sm:text-2xl font-extrabold">Cách ghi chép Cornell trong Lucy Notes</h2>
          <p className="mt-4">Phương pháp Cornell chia trang ghi chép làm 3 phần: <b>cột từ khoá/câu hỏi</b> bên trái, <b>phần ghi chép</b> bên phải và <b>phần tóm tắt</b> cuối trang. Cách chia này buộc bạn tự đặt câu hỏi và tóm tắt bằng lời của mình — hai việc giúp nhớ bài lâu hơn so với chỉ chép lại.</p>
          <ol className="mt-4 list-decimal pl-6 space-y-1.5">
            <li>Tạo trang mới, chọn mẫu <b>Ghi chép Cornell</b>.</li>
            <li>Trong giờ học: ghi ý chính vào cột phải (hoặc bật ghi âm và chọn kiểu “Cornell” để AI chia sẵn).</li>
            <li>Sau giờ học: viết câu hỏi/từ khoá cho từng ý vào cột trái, che cột phải và tự trả lời.</li>
            <li>Viết 2–3 câu tóm tắt cuối trang, rồi bật <b>Ôn lại trang này</b> để được nhắc ôn sau 1, 3, 7 ngày.</li>
            <li>Trước kiểm tra: mở Trợ lý AI › Học › Quiz để tự kiểm tra bằng câu hỏi tạo từ chính trang Cornell.</li>
          </ol>
        </section>

        <ToolFaq faqs={FAQS} />

        <section className="ui-card p-6 sm:p-10 text-center" data-reveal="zoom">
          <h2 className="text-2xl md:text-3xl font-extrabold text-primary">Ghi chép thông minh hơn từ buổi học tới</h2>
          <p className="text-muted mt-3 max-w-xl mx-auto">Mở là dùng, không cần đăng nhập. Ghi chú luôn là của bạn — xuất ra Markdown, PDF, ảnh bất cứ lúc nào.</p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <Link href={APP} className="btn-primary px-7 py-3.5 text-base">Mở Ghi chú ngay — miễn phí</Link>
            <Link href="/#cong-cu-mien-phi" className="btn-outline px-7 py-3.5 text-base">Xem công cụ học miễn phí</Link>
          </div>
        </section>
      </div>
    </div>
  );
}
