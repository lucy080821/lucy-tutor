import { pageMetadata } from "@/lib/seo";
import { ToolBanner, ToolJsonLd, ToolFaq, ToolCta, RelatedTools, ToolNextSteps, type Faq } from "@/components/tools/ToolPage";
import { PHOTOS } from "@/lib/photos";
import EndingSoundsTool from "@/components/tools/EndingSoundsTool";

// Từ khoá chính: "cách phát âm ed" + "cách phát âm s es"
// Từ khoá phụ: cách phát âm đuôi ed, cách phát âm đuôi s es, cách phát âm ed bằng câu thần chú,
// cách phát âm s es bằng câu thần chú, cách phát âm ed mẹo, bài tập phát âm ed s es, quy tắc phát âm s/es/ed
// Search Console 10/2026: top ~100 → title/H1/H2 dùng đúng cụm người Việt hay gõ ("cách phát âm s es",
// "cách phát âm đuôi ed", "quy tắc phát âm s/es/ed"), thêm IPA cho ví dụ, mẹo nhớ và bài tập có đáp án
const PATH = "/cach-phat-am-ed-s-es";
const TITLE = "Cách Phát Âm S, ES, ED: Quy Tắc & Mẹo Nhớ";
const DESCRIPTION =
  "Cách phát âm s es (/s/, /z/, /ɪz/) và đuôi ed (/t/, /d/, /ɪd/): bảng quy tắc phát âm s/es/ed, ví dụ có IPA, câu thần chú, ngoại lệ, bài tập có đáp án.";

export const metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: PATH,
  image: PHOTOS.pronunciation,
  keywords: [
    "cách phát âm ed", "cách phát âm đuôi ed", "cách phát âm s es", "cách phát âm đuôi s es",
    "cách phát âm ed bằng câu thần chú", "cách phát âm s es bằng câu thần chú", "cách phát âm ed mẹo",
    "bài tập phát âm ed", "bài tập phát âm s es", "phát âm ed s es", "quy tắc phát âm s/es/ed", "quy tắc phát âm s es ed",
  ],
});

const CRUMBS = [{ name: "Cách phát âm s, es, ed", href: PATH }];

// Bài tập ngắn kiểu đề THPT (chọn từ có phần gạch chân phát âm khác) — đáp án render sẵn trong HTML.
// Đã đối chiếu với classifyEd/classifyS trong lib/tools/endingSounds.ts.
const EXERCISES: { words: [string, string][]; answer: number; why: string }[] = [
  { words: [["stopp", "ed"], ["watch", "ed"], ["play", "ed"], ["laugh", "ed"]], answer: 2, why: "played đọc /d/ (tận cùng nguyên âm), 3 từ còn lại đọc /t/." },
  { words: [["want", "ed"], ["need", "ed"], ["decid", "ed"], ["clean", "ed"]], answer: 3, why: "cleaned đọc /d/, 3 từ còn lại tận cùng /t/, /d/ nên đọc /ɪd/." },
  { words: [["book", "s"], ["pen", "s"], ["cat", "s"], ["stop", "s"]], answer: 1, why: "pens đọc /z/ (âm /n/ hữu thanh), 3 từ còn lại đọc /s/." },
  { words: [["watch", "es"], ["box", "es"], ["dog", "s"], ["bus", "es"]], answer: 2, why: "dogs đọc /z/, 3 từ còn lại tận cùng âm gió nên đọc /ɪz/." },
  { words: [["nak", "ed"], ["look", "ed"], ["work", "ed"], ["cook", "ed"]], answer: 0, why: "naked là tính từ ngoại lệ đọc /ɪd/, 3 từ còn lại đọc /t/." },
  { words: [["month", "s"], ["clothe", "s"], ["laugh", "s"], ["stomach", "s"]], answer: 1, why: "clothes đọc /z/ (âm /ð/ hữu thanh); months, laughs, stomachs đọc /s/." },
];

const FAQS: Faq[] = [
  { q: "Câu thần chú phát âm đuôi -ed là gì?", a: "Đuôi -ed đọc là /t/ khi từ gốc tận cùng bằng các âm trong câu \"Khi Sang Sông Phải Chờ Thu Phí\" (k, s, sh, p, ch, th, f). Đọc /ɪd/ khi từ gốc tận cùng bằng /t/ hoặc /d/. Các trường hợp còn lại đọc /d/." },
  { q: "Câu thần chú phát âm đuôi -s/-es là gì?", a: "Đuôi -s đọc là /s/ khi từ gốc tận cùng bằng các âm trong câu \"Thời Phong Kiến Phương Tây\" (th, p, k, f, t). Đọc /ɪz/ khi từ gốc tận cùng bằng âm gió: s, ss, x, z, sh, ch, ce, se, ge. Các trường hợp còn lại đọc /z/." },
  { q: "Vì sao phải dựa vào âm cuối chứ không phải chữ cái cuối?", a: "Vì chữ viết tiếng Anh không luôn khớp với âm. Ví dụ laugh viết bằng \"gh\" nhưng đọc /f/ nên laughed đọc /t/; house có âm /s/ nhưng houses đọc /ˈhaʊzɪz/. Công cụ trên trang đã tính sẵn các trường hợp này." },
  { q: "Những tính từ đuôi -ed nào đọc là /ɪd/?", a: "Một số tính từ đọc /ɪd/ dù âm cuối không phải t/d: naked, wicked, beloved, crooked, ragged, rugged, sacred, wretched, dogged, learned (uyên bác), aged (cao tuổi), blessed, cursed. Đây là ngoại lệ hay gặp trong đề thi." },
  { q: "Công cụ có chính xác 100% không?", a: "Công cụ dựa trên quy tắc chính tả và danh sách ngoại lệ phổ biến nên đúng với hầu hết từ trong sách giáo khoa và đề thi. Với từ hiếm, bạn nên tra thêm phiên âm trong từ điển." },
];

export default function Page() {
  return (
    <div className="min-h-screen bg-background">
      <ToolJsonLd name={TITLE} path={PATH} description={DESCRIPTION} crumbs={CRUMBS} faqs={FAQS} image={PHOTOS.pronunciation} />
      <ToolBanner crumbs={CRUMBS} title="Cách Phát Âm S, ES và Đuôi ED – Quy Tắc Dễ Nhớ"
        subtitle="Quy tắc phát âm s/es/ed kèm ví dụ IPA và câu thần chú. Gõ từ bất kỳ để biết đọc /s/, /z/, /ɪz/ hay /t/, /d/, /ɪd/."
        photo={PHOTOS.pronunciation} highlights={["/t/ · /d/ · /ɪd/", "/s/ · /z/ · /ɪz/ + câu thần chú"]} cta="Tra cách phát âm ngay" />

      <div id="bat-dau" className="max-w-5xl mx-auto px-4 py-6 sm:py-8 scroll-mt-16">
        <EndingSoundsTool />

        <article className="mt-12 space-y-4 text-foreground/90 leading-relaxed">
            <h2 className="ui-section-title text-xl">Quy tắc phát âm s/es/ed tóm tắt</h2>
            <div className="overflow-x-auto">
              <table className="ui-table w-full text-sm">
                <thead><tr><th>Đuôi</th><th>Đọc</th><th>Khi âm cuối của từ gốc là</th><th>Mẹo nhớ</th></tr></thead>
                <tbody>
                  <tr><td rowSpan={3}><b>-s / -es</b></td><td><b>/ɪz/</b></td><td>/s/, /z/, /ʃ/, /ʒ/, /tʃ/, /dʒ/ (âm gió)</td><td>s, ss, x, z, sh, ch, ce, se, ge</td></tr>
                  <tr><td><b>/s/</b></td><td>/p/, /t/, /k/, /f/, /θ/ (vô thanh)</td><td>&ldquo;Thời Phong Kiến Phương Tây&rdquo;</td></tr>
                  <tr><td><b>/z/</b></td><td>Nguyên âm và phụ âm hữu thanh còn lại</td><td>Còn lại</td></tr>
                  <tr><td rowSpan={3}><b>-ed</b></td><td><b>/ɪd/</b></td><td>/t/, /d/</td><td>Tận cùng t, d</td></tr>
                  <tr><td><b>/t/</b></td><td>/p/, /k/, /f/, /s/, /ʃ/, /tʃ/, /θ/ (vô thanh)</td><td>&ldquo;Khi Sang Sông Phải Chờ Thu Phí&rdquo;</td></tr>
                  <tr><td><b>/d/</b></td><td>Nguyên âm và phụ âm hữu thanh còn lại</td><td>Còn lại</td></tr>
                </tbody>
              </table>
            </div>
            <h2 className="ui-section-title text-xl pt-4">Vì sao cần phát âm đúng đuôi s, es, ed?</h2>
            <p>
              Đuôi -ed cho biết hành động đã xảy ra, đuôi -s/-es cho biết danh từ số nhiều hoặc động từ chia ngôi thứ ba.
              Nuốt mất âm cuối khiến người nghe không phân biệt được &ldquo;I work&rdquo; với &ldquo;I worked&rdquo;, hay
              &ldquo;book&rdquo; với &ldquo;books&rdquo; — lỗi rất phổ biến ở người Việt vì tiếng Việt không có phụ âm cuối kép.
            </p>
            <p>Câu hỏi chọn từ có phần gạch chân phát âm khác cũng xuất hiện thường xuyên trong phần Ngữ âm của đề thi tốt nghiệp THPT.</p>
          <h2 className="ui-section-title text-xl pt-4">Cách phát âm đuôi ed</h2>
          <div className="overflow-x-auto">
            <table className="ui-table w-full text-sm">
              <thead><tr><th>Cách đọc</th><th>Khi từ gốc tận cùng bằng</th><th>Ví dụ có phiên âm IPA</th></tr></thead>
              <tbody>
                <tr><td><b>/ɪd/</b></td><td>Âm /t/, /d/</td><td>wanted /ˈwɒntɪd/, needed /ˈniːdɪd/, decided /dɪˈsaɪdɪd/, visited /ˈvɪzɪtɪd/</td></tr>
                <tr><td><b>/t/</b></td><td>Âm vô thanh /p/, /k/, /f/, /s/, /ʃ/, /tʃ/, /θ/ — thường viết là p, k, f, gh, ph, s, ss, x, ce, sh, ch</td><td>stopped /stɒpt/, looked /lʊkt/, laughed /lɑːft/, missed /mɪst/, washed /wɒʃt/, watched /wɒtʃt/</td></tr>
                <tr><td><b>/d/</b></td><td>Nguyên âm và các phụ âm hữu thanh còn lại</td><td>played /pleɪd/, cleaned /kliːnd/, lived /lɪvd/, changed /tʃeɪndʒd/, studied /ˈstʌdid/</td></tr>
              </tbody>
            </table>
          </div>
          <p><b>Câu thần chú -ed:</b> &ldquo;<b>Kh</b>i <b>S</b>ang <b>S</b>ông <b>Ph</b>ải <b>Ch</b>ờ <b>Th</b>u <b>Ph</b>í&rdquo; → k, s, sh, p, ch, th, f đọc <b>/t/</b>. Nhớ thêm: tận cùng t, d đọc <b>/ɪd/</b>; còn lại đọc <b>/d/</b>.</p>

          <h2 className="ui-section-title text-xl pt-4">Cách phát âm s es</h2>
          <div className="overflow-x-auto">
            <table className="ui-table w-full text-sm">
              <thead><tr><th>Cách đọc</th><th>Khi từ gốc tận cùng bằng</th><th>Ví dụ có phiên âm IPA</th></tr></thead>
              <tbody>
                <tr><td><b>/ɪz/</b></td><td>Âm gió /s/, /z/, /ʃ/, /ʒ/, /tʃ/, /dʒ/ — thường viết là s, ss, x, z, sh, ch, ce, se, ge</td><td>watches /ˈwɒtʃɪz/, boxes /ˈbɒksɪz/, buses /ˈbʌsɪz/, changes /ˈtʃeɪndʒɪz/, houses /ˈhaʊzɪz/</td></tr>
                <tr><td><b>/s/</b></td><td>Âm vô thanh /p/, /t/, /k/, /f/, /θ/</td><td>books /bʊks/, cats /kæts/, stops /stɒps/, laughs /lɑːfs/, months /mʌnθs/</td></tr>
                <tr><td><b>/z/</b></td><td>Nguyên âm và các phụ âm hữu thanh còn lại</td><td>dogs /dɒɡz/, pens /penz/, plays /pleɪz/, trees /triːz/, clothes /kləʊðz/</td></tr>
              </tbody>
            </table>
          </div>
          <p><b>Câu thần chú -s/-es:</b> &ldquo;<b>Th</b>ời <b>Ph</b>ong <b>K</b>iến <b>Ph</b>ương <b>T</b>ây&rdquo; → th, p, k, f, t đọc <b>/s/</b>. Âm gió (s, ss, x, z, sh, ch, ce, ge) đọc <b>/ɪz/</b>; còn lại đọc <b>/z/</b>.</p>

          <h2 className="ui-section-title text-xl pt-4">Mẹo nhớ cách phát âm s, es, ed</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li><b>Nghe âm, đừng nhìn chữ:</b> xét âm cuối của từ gốc trong phiên âm, không phải chữ cái cuối (laugh tận cùng chữ &ldquo;h&rdquo; nhưng âm /f/).</li>
            <li><b>Đặt tay lên cổ họng:</b> đọc âm cuối của từ gốc — cổ rung là âm hữu thanh (đọc /z/, /d/), không rung là vô thanh (đọc /s/, /t/).</li>
            <li><b>Thêm 1 âm tiết khi cần:</b> /ɪz/ và /ɪd/ là 2 trường hợp duy nhất làm từ dài thêm 1 âm tiết (wash → wash-es, want → want-ed), vì dính liền sẽ không đọc được.</li>
            <li><b>Chỉ học thuộc 2 nhóm:</b> nhớ nhóm /ɪz/ – /s/ (đuôi s) và /ɪd/ – /t/ (đuôi ed) bằng câu thần chú, mọi trường hợp còn lại đọc /z/ hoặc /d/.</li>
          </ul>

          <h2 className="ui-section-title text-xl pt-4">Các ngoại lệ hay gặp trong đề thi</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Tính từ đọc <b>/ɪd/</b>: naked, wicked, beloved, crooked, ragged, sacred, learned, aged, blessed.</li>
            <li>&ldquo;gh&rdquo; đọc /f/: laughed, coughed đọc <b>/t/</b>; laughs, coughs đọc <b>/s/</b>.</li>
            <li>&ldquo;ch&rdquo; đọc /k/: stomachs, monarchs, headaches đọc <b>/s/</b> (không phải /ɪz/).</li>
            <li>houses đọc /ˈhaʊzɪz/; clothes đọc /kləʊðz/; says đọc /sez/; does đọc /dʌz/.</li>
          </ul>

          <h2 className="ui-section-title text-xl pt-4">Bài tập phát âm s es ed (có đáp án)</h2>
          <p>Chọn từ có phần gạch chân phát âm khác với 3 từ còn lại. Bấm vào từng câu để xem đáp án. Muốn làm thêm câu ngẫu nhiên, dùng phần &ldquo;Luyện tập&rdquo; trong công cụ phía trên.</p>
          <ol className="space-y-3 list-decimal pl-6">
            {EXERCISES.map((ex, i) => (
              <li key={i}>
                <p className="flex flex-wrap gap-x-5 gap-y-1">
                  {ex.words.map(([stem, end], k) => (
                    <span key={k}>{"ABCD"[k]}. {stem}<u className="font-bold">{end}</u></span>
                  ))}
                </p>
                <details className="mt-1 text-sm">
                  <summary className="cursor-pointer text-primary font-semibold">Xem đáp án</summary>
                  <p className="mt-1 text-muted">Đáp án <b className="text-foreground">{"ABCD"[ex.answer]}</b> — {ex.why}</p>
                </details>
              </li>
            ))}
          </ol>
        </article>

        <ToolNextSteps links={[
          { href: "/phonetics", label: "Bảng phiên âm IPA 44 âm", text: "bấm nghe /s/, /z/, /ɪz/, /t/, /d/ và phân biệt âm hữu thanh, vô thanh." },
          { href: "/flashcard-tieng-anh", label: "Flashcard tiếng Anh Global Success lớp 1–12", text: "học từ vựng theo Unit có phiên âm, tải PDF miễn phí để in." },
          { href: "/bang-dong-tu-bat-quy-tac", label: "Bảng động từ bất quy tắc", text: "động từ bất quy tắc không thêm -ed — tra V2, V3 kèm phát âm." },
        ]} />

        <ToolFaq faqs={FAQS} />
        <ToolCta text="Luyện phát âm cùng AI: ghi âm giọng nói, so khớp với từ mẫu và nhận góp ý sửa lỗi phát âm." />
        <RelatedTools current={PATH} featured={["/phonetics", "/flashcard-tieng-anh", "/bang-dong-tu-bat-quy-tac"]} />
      </div>
    </div>
  );
}
