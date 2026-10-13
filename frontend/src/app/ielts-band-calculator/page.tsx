import { pageMetadata } from "@/lib/seo";
import { ToolBanner, ToolJsonLd, ToolFaq, ToolCta, RelatedTools, ToolNextSteps, type Faq } from "@/components/tools/ToolPage";
import { PHOTOS } from "@/lib/photos";
import IeltsBandCalculator from "@/components/tools/IeltsBandCalculator";
import { LISTENING_BAND_TABLE, READING_BAND_TABLE_ACADEMIC, READING_BAND_TABLE_GT, bandRanges, fmtBand, rawScoreToBand } from "@/lib/tools/ieltsBand";

// Từ khoá chính: "ielts band calculator" / "cách tính điểm ielts"
// Từ khoá phụ: ielts band score calculator, bảng quy đổi điểm ielts listening, bảng quy đổi điểm ielts reading,
// ielts band score reading, ielts band score listening, cách tính điểm overall ielts, quy đổi điểm ielts
// Search Console 10/2026: top 29 với "21/40 ielts listening" → thêm bảng tra từng điểm 0–40 (HTML table thật)
// + đoạn trả lời trực tiếp "21/40 Listening = band 5.5" (số lấy từ bảng quy đổi, không gõ tay)
const PATH = "/ielts-band-calculator";
const L = (raw: number) => fmtBand(rawScoreToBand(raw, LISTENING_BAND_TABLE));
const RA = (raw: number) => fmtBand(rawScoreToBand(raw, READING_BAND_TABLE_ACADEMIC));
const RG = (raw: number) => fmtBand(rawScoreToBand(raw, READING_BAND_TABLE_GT));
const TITLE = "IELTS Band Calculator & Bảng Quy Đổi Điểm /40";
const DESCRIPTION =
  `Tính điểm IELTS miễn phí: tra nhanh 0–40 câu đúng ra band Listening, Reading Academic/General (vd 21/40 Listening = band ${L(21)}) và tính band Overall.`;

export const metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: PATH,
  image: PHOTOS.ielts,
  keywords: [
    "ielts band calculator", "ielts band score calculator", "cách tính điểm ielts", "cách tính điểm overall ielts",
    "bảng quy đổi điểm ielts", "bảng quy đổi điểm ielts listening", "bảng quy đổi điểm ielts reading",
    "ielts band score reading", "ielts band score listening", "tính điểm ielts online",
    "21/40 ielts listening", "ielts listening score /40", "ielts reading score /40", "bảng điểm ielts listening /40",
  ],
});

const CRUMBS = [{ name: "IELTS Band Calculator", href: PATH }];

const FAQS: Faq[] = [
  { q: "21/40 IELTS Listening được bao nhiêu band?", a: `21/40 câu đúng Listening tương đương band ${L(21)}. Với Reading, 21/40 tương đương band ${RA(21)} (Academic) và ${RG(21)} (General Training). Theo bảng quy đổi phổ biến, có thể lệch ±1 câu tuỳ đề.` },
  { q: "Cách tính điểm IELTS Overall như thế nào?", a: "Band Overall là trung bình cộng band của 4 kỹ năng Listening, Reading, Writing, Speaking, sau đó làm tròn: nếu phần lẻ là .25 thì làm tròn lên .5, nếu là .75 thì làm tròn lên band nguyên kế tiếp. Ví dụ (6.5 + 6.5 + 5.5 + 6.0) ÷ 4 = 6.125 → 6.0; (7.0 + 6.5 + 6.0 + 6.5) ÷ 4 = 6.5." },
  { q: "Làm đúng bao nhiêu câu Listening thì được 6.5?", a: "Theo bảng quy đổi phổ biến, Listening cần khoảng 26–29 câu đúng trên 40 để đạt band 6.5, và 30–31 câu để đạt 7.0." },
  { q: "Reading Academic và General Training quy đổi có khác nhau không?", a: "Có. Bài Reading General Training có văn bản đơn giản hơn nên cần nhiều câu đúng hơn cho cùng một band. Ví dụ band 6.0 cần khoảng 27 câu với Academic nhưng khoảng 30 câu với General Training." },
  { q: "Bảng quy đổi này có phải bảng chính thức không?", a: "Không. IELTS không công bố một bảng quy đổi chung cho mọi đề; mỗi đề thi thật có thể lệch khoảng ±1 câu ở ngưỡng band. Đây là bảng quy đổi được dùng phổ biến trong tài liệu luyện thi, phù hợp để tự chấm đề luyện tập." },
  { q: "Writing và Speaking tính band thế nào?", a: "Writing và Speaking do giám khảo chấm theo 4 tiêu chí, mỗi tiêu chí một band rồi lấy trung bình. Với Writing, Task 2 chiếm trọng số gấp đôi Task 1. Bạn có thể dùng công cụ Chấm Writing miễn phí của Lucy Tutor để ước tính band bài viết." },
];

function BandTable({ caption, table }: { caption: string; table: typeof LISTENING_BAND_TABLE }) {
  return (
    <div className="overflow-x-auto">
      <table className="ui-table w-full text-sm">
        <caption className="text-left font-bold text-primary pb-2">{caption}</caption>
        <thead><tr><th>Số câu đúng (/40)</th><th>Band</th></tr></thead>
        <tbody>
          {bandRanges(table).map((r) => (
            <tr key={r.band}><td>{r.from === r.to ? r.from : `${r.from}–${r.to}`}</td><td><b>{fmtBand(r.band)}</b></td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Điểm thô hay được tìm kiếm — câu trả lời trực tiếp ngay đầu phần nội dung
const POPULAR_RAW = [15, 18, 20, 21, 23, 25, 27, 30, 33, 35];
const RAWS = Array.from({ length: 41 }, (_, i) => 40 - i);

function RawScoreTable() {
  return (
    <div className="overflow-x-auto">
      <table className="ui-table w-full text-sm">
        <caption className="text-left font-bold text-primary pb-2">Bảng tra điểm IELTS từng câu: số câu đúng /40 → band</caption>
        <thead><tr><th>Số câu đúng</th><th>Listening</th><th>Reading Academic</th><th>Reading General</th></tr></thead>
        <tbody>
          {RAWS.map((r) => (
            <tr key={r} id={`diem-${r}`}><td><b>{r}/40</b></td><td>{L(r)}</td><td>{RA(r)}</td><td>{RG(r)}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Page() {
  return (
    <div className="min-h-screen bg-background">
      <ToolJsonLd name={TITLE} path={PATH} description={DESCRIPTION} crumbs={CRUMBS} faqs={FAQS} image={PHOTOS.ielts} />
      <ToolBanner crumbs={CRUMBS} title="IELTS Band Calculator — Tính Điểm IELTS Online"
        subtitle="Nhập số câu đúng Listening, Reading và band Writing, Speaking để biết band từng kỹ năng và điểm Overall."
        photo={PHOTOS.ielts} highlights={["Listening · Reading · Writing · Speaking", "Tự làm tròn band Overall"]} cta="Tính điểm ngay" />

      <div id="bat-dau" className="max-w-5xl mx-auto px-4 py-6 sm:py-8 scroll-mt-16">
        <IeltsBandCalculator />

        <section className="mt-12 space-y-4 text-foreground/90 leading-relaxed" aria-labelledby="hoi-21-40">
          <h2 id="hoi-21-40" className="ui-section-title text-xl">21/40 IELTS Listening được bao nhiêu band?</h2>
          <p className="ui-card p-5 text-base">
            <b>21/40 câu đúng IELTS Listening tương đương band {L(21)}.</b> Cùng 21/40 câu đúng, Reading Academic được
            band {RA(21)} và Reading General Training được band {RG(21)}. Muốn lên band {L(23)} Listening bạn cần khoảng
            23/40 câu; band 6.5 cần khoảng 26/40 câu.
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 list-disc pl-6">
            {POPULAR_RAW.map((r) => (
              <li key={r}><b>{r}/40</b> Listening = band <b>{L(r)}</b> · Reading Academic = {RA(r)} · General = {RG(r)}</li>
            ))}
          </ul>
        </section>

        <section className="mt-12 space-y-4 text-foreground/90 leading-relaxed">
            <h2 className="ui-section-title text-xl">Bảng quy đổi điểm IELTS Listening và Reading</h2>
            <p>
              Listening và Reading mỗi bài có 40 câu, mỗi câu đúng được 1 điểm. Tổng số câu đúng được quy đổi sang band 1–9
              theo các bảng dưới đây (bảng phổ biến trong tài liệu luyện thi, có thể lệch ±1 câu tuỳ đề).
            </p>
            <p>
              Writing và Speaking không đếm câu đúng mà do giám khảo chấm theo 4 tiêu chí. Khi đã có band của cả 4 kỹ năng,
              lấy trung bình cộng rồi làm tròn theo quy tắc bên dưới để ra band Overall.
            </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <BandTable caption="Listening (Academic & General)" table={LISTENING_BAND_TABLE} />
            <BandTable caption="Reading Academic" table={READING_BAND_TABLE_ACADEMIC} />
            <BandTable caption="Reading General Training" table={READING_BAND_TABLE_GT} />
          </div>

          <h2 className="ui-section-title text-xl pt-4">Bảng tra từng điểm từ 0 đến 40 câu đúng</h2>
          <p>Tra nhanh band của đúng số câu bạn làm được — mỗi dòng là 1 điểm thô, cho cả 3 bài Listening, Reading Academic và Reading General Training.</p>
          <RawScoreTable />

          <h2 className="ui-section-title text-xl pt-4">Quy tắc làm tròn band Overall</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Trung bình lẻ dưới .25 → làm tròn xuống band nguyên. Ví dụ 6.125 → <b>6.0</b>.</li>
            <li>Trung bình lẻ .25 → làm tròn lên .5. Ví dụ 6.25 → <b>6.5</b>.</li>
            <li>Trung bình lẻ .75 → làm tròn lên band nguyên kế tiếp. Ví dụ 6.75 → <b>7.0</b>.</li>
          </ul>
        </section>

        <ToolNextSteps links={[
          { href: "/cham-writing-mien-phi", label: "Chấm IELTS Writing miễn phí bằng AI", text: "chưa có band Writing? Dán bài Task 1/Task 2 để AI ước tính band theo 4 tiêu chí." },
          { href: "/kiem-tra-trinh-do-tieng-anh", label: "Kiểm tra trình độ tiếng Anh", text: "30 câu, 15 phút, biết trình độ CEFR A1–C1 trước khi luyện đề IELTS." },
        ]} />
        <ToolFaq faqs={FAQS} />
        <ToolCta text="Làm đề IELTS Cambridge đủ 4 kỹ năng, AI chấm Writing/Speaking theo band và theo dõi tiến bộ từng kỹ năng." />
        <RelatedTools current={PATH} featured={["/cham-writing-mien-phi", "/kiem-tra-trinh-do-tieng-anh"]} />
      </div>
    </div>
  );
}
