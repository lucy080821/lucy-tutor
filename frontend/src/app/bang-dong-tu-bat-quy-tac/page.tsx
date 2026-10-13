import { pageMetadata } from "@/lib/seo";
import { PHOTOS } from "@/lib/photos";
import { ToolBanner, ToolJsonLd, ToolFaq, ToolCta, RelatedTools, type Faq } from "@/components/tools/ToolPage";
import IrregularVerbsTool from "@/components/tools/IrregularVerbsTool";
import { IRREGULAR_VERBS } from "@/lib/tools/irregularVerbs";

// Từ khoá chính: "bảng động từ bất quy tắc"
// Từ khoá phụ: bảng động từ bất quy tắc pdf, bảng động từ bất quy tắc thông dụng, bảng động từ bất quy tắc v1 v2 v3,
// bảng động từ bất quy tắc full, động từ bất quy tắc trong tiếng anh, động từ bất quy tắc thường gặp, động từ bất quy tắc v2
const PATH = "/bang-dong-tu-bat-quy-tac";
const TOTAL = IRREGULAR_VERBS.length;
const COMMON = IRREGULAR_VERBS.filter((v) => v.common).length;
const TITLE = `Bảng Động Từ Bất Quy Tắc V1 V2 V3 – Tải PDF`;
const DESCRIPTION =
  `Bảng ${TOTAL} động từ bất quy tắc tiếng Anh thông dụng đủ V1, V2, V3 kèm nghĩa tiếng Việt: tra cứu nhanh, nghe phát âm, luyện tập và tải PDF miễn phí.`;

export const metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: PATH,
  image: PHOTOS.irregularVerbs,
  keywords: [
    "bảng động từ bất quy tắc", "bảng động từ bất quy tắc pdf", "bảng động từ bất quy tắc thông dụng",
    "bảng động từ bất quy tắc v1 v2 v3", "bảng động từ bất quy tắc full", "động từ bất quy tắc trong tiếng anh",
    "động từ bất quy tắc thường gặp", "động từ bất quy tắc v2", "irregular verbs",
  ],
});

const CRUMBS = [{ name: "Bảng động từ bất quy tắc", href: PATH }];

const FAQS: Faq[] = [
  { q: "Động từ bất quy tắc là gì?", a: "Động từ bất quy tắc (irregular verbs) là động từ không tạo thì quá khứ (V2) và quá khứ phân từ (V3) bằng cách thêm -ed như động từ thường. Ví dụ go – went – gone, write – wrote – written. Cách duy nhất là học thuộc." },
  { q: "V1, V2, V3 dùng trong trường hợp nào?", a: "V1 là động từ nguyên mẫu (hiện tại đơn, sau to, sau động từ khuyết thiếu). V2 dùng cho thì quá khứ đơn (I went). V3 dùng cho các thì hoàn thành (I have gone) và câu bị động (The letter was written)." },
  { q: "Có bao nhiêu động từ bất quy tắc cần học?", a: `Tiếng Anh có khoảng 200 động từ bất quy tắc nhưng phần lớn ít dùng. Bảng này gồm ${TOTAL} động từ thường gặp; bật "Chỉ động từ thông dụng" để xem ${COMMON} động từ hay xuất hiện nhất trong sách giáo khoa và đề thi THPT.` },
  { q: "Vì sao có từ có 2 dạng như learnt/learned?", a: "Dạng -t (learnt, burnt, dreamt) phổ biến hơn trong tiếng Anh-Anh, dạng -ed (learned, burned, dreamed) phổ biến trong tiếng Anh-Mỹ. Cả hai đều đúng; phần luyện tập chấp nhận cả hai." },
  { q: "Mẹo học thuộc động từ bất quy tắc nhanh?", a: "Học theo nhóm có cùng quy luật: nhóm 3 dạng giống nhau (cut – cut – cut, put – put – put), nhóm i – a – u (sing – sang – sung, drink – drank – drunk), nhóm V2 = V3 (buy – bought – bought). Mỗi ngày đọc to 10 động từ và tự kiểm tra bằng phần Luyện tập." },
];

export default function Page() {
  return (
    <div className="min-h-screen bg-background">
      <ToolJsonLd name={TITLE} path={PATH} description={DESCRIPTION} crumbs={CRUMBS} faqs={FAQS} image={PHOTOS.irregularVerbs} />
      <ToolBanner crumbs={CRUMBS} title="Bảng Động Từ Bất Quy Tắc Tiếng Anh"
        subtitle={`${TOTAL} động từ bất quy tắc thông dụng đủ V1 – V2 – V3 kèm nghĩa: tra cứu, nghe phát âm, luyện tập và tải PDF.`}
        photo={PHOTOS.irregularVerbs} highlights={[`${TOTAL} động từ · V1 V2 V3`, "Tải bảng PDF miễn phí"]} cta="Tra bảng ngay" />

      <div id="bat-dau" className="max-w-5xl mx-auto px-4 py-6 sm:py-8 scroll-mt-16">
        <IrregularVerbsTool />

        <section className="mt-12 space-y-4 text-foreground/90 leading-relaxed">
          <h2 className="ui-section-title text-xl">Cách dùng V1, V2, V3 trong câu</h2>
          <div className="overflow-x-auto">
            <table className="ui-table w-full text-sm">
              <thead><tr><th>Dạng</th><th>Dùng khi</th><th>Ví dụ</th></tr></thead>
              <tbody>
                <tr><td><b>V1</b> — nguyên mẫu</td><td>Hiện tại đơn, sau &ldquo;to&rdquo;, sau can/will/must…</td><td>I <b>write</b> a diary every day.</td></tr>
                <tr><td><b>V2</b> — quá khứ đơn</td><td>Hành động đã xảy ra và kết thúc trong quá khứ</td><td>She <b>wrote</b> a letter yesterday.</td></tr>
                <tr><td><b>V3</b> — quá khứ phân từ</td><td>Các thì hoàn thành, câu bị động</td><td>I have <b>written</b> two essays. / The book was <b>written</b> in 1990.</td></tr>
              </tbody>
            </table>
          </div>
          <h2 className="ui-section-title text-xl pt-4">Học động từ bất quy tắc theo nhóm</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li><b>3 dạng giống nhau:</b> cut – cut – cut, put – put – put, hit – hit – hit, let – let – let, cost – cost – cost.</li>
            <li><b>V2 và V3 giống nhau:</b> buy – bought – bought, teach – taught – taught, keep – kept – kept, feel – felt – felt.</li>
            <li><b>Nhóm i – a – u:</b> sing – sang – sung, drink – drank – drunk, swim – swam – swum, begin – began – begun.</li>
            <li><b>V3 thêm -n/-en:</b> take – took – taken, write – wrote – written, eat – ate – eaten, speak – spoke – spoken.</li>
          </ul>
        </section>

        <ToolFaq faqs={FAQS} />
        <ToolCta text="Ôn ngữ pháp theo chuyên đề, làm đề thi thử THPT có tính giờ và lưu lỗi sai để ôn lại." />
        <RelatedTools current={PATH} />
      </div>
    </div>
  );
}
