import { pageMetadata } from "@/lib/seo";
import { ToolBanner, ToolJsonLd, ToolFaq, ToolCta, RelatedTools, type Faq } from "@/components/tools/ToolPage";
import { PHOTOS } from "@/lib/photos";
import EndingSoundsTool from "@/components/tools/EndingSoundsTool";

// Từ khoá chính: "cách phát âm ed" + "cách phát âm s es"
// Từ khoá phụ: cách phát âm đuôi ed, cách phát âm đuôi s es, cách phát âm ed bằng câu thần chú,
// cách phát âm s es bằng câu thần chú, cách phát âm ed mẹo, bài tập phát âm ed s es
const PATH = "/cach-phat-am-ed-s-es";
const TITLE = "Cách Phát Âm Đuôi -ed và -s/-es: Công Cụ Tra Cứu + Câu Thần Chú";
const DESCRIPTION =
  "Cách phát âm đuôi ed (/t/, /d/, /ɪd/) và đuôi s, es (/s/, /z/, /ɪz/) dễ nhớ bằng câu thần chú. Gõ từ bất kỳ để biết cách đọc, kèm ngoại lệ và bài tập phát âm kiểu đề thi THPT miễn phí.";

export const metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: PATH,
  image: PHOTOS.pronunciation,
  keywords: [
    "cách phát âm ed", "cách phát âm đuôi ed", "cách phát âm s es", "cách phát âm đuôi s es",
    "cách phát âm ed bằng câu thần chú", "cách phát âm s es bằng câu thần chú", "cách phát âm ed mẹo",
    "bài tập phát âm ed", "bài tập phát âm s es", "phát âm ed s es",
  ],
});

const CRUMBS = [{ name: "Cách phát âm -ed, -s/-es", href: PATH }];

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
      <ToolBanner crumbs={CRUMBS} title="Cách Phát Âm Đuôi -ed và -s/-es"
        subtitle="Gõ từ bất kỳ để biết đọc /t/, /d/, /ɪd/ hay /s/, /z/, /ɪz/ — kèm câu thần chú và bài luyện kiểu đề THPT."
        photo={PHOTOS.pronunciation} highlights={["/t/ · /d/ · /ɪd/", "/s/ · /z/ · /ɪz/ + câu thần chú"]} cta="Tra cách phát âm ngay" />

      <div id="bat-dau" className="max-w-5xl mx-auto px-4 py-6 sm:py-8 scroll-mt-16">
        <EndingSoundsTool />

        <article className="mt-12 space-y-4 text-foreground/90 leading-relaxed">
            <h2 className="ui-section-title text-xl">Vì sao cần phát âm đúng đuôi -ed và -s/-es?</h2>
            <p>
              Đuôi -ed cho biết hành động đã xảy ra, đuôi -s/-es cho biết danh từ số nhiều hoặc động từ chia ngôi thứ ba.
              Nuốt mất âm cuối khiến người nghe không phân biệt được &ldquo;I work&rdquo; với &ldquo;I worked&rdquo;, hay
              &ldquo;book&rdquo; với &ldquo;books&rdquo; — lỗi rất phổ biến ở người Việt vì tiếng Việt không có phụ âm cuối kép.
            </p>
            <p>Câu hỏi chọn từ có phần gạch chân phát âm khác cũng xuất hiện thường xuyên trong phần Ngữ âm của đề thi tốt nghiệp THPT.</p>
          <h2 className="ui-section-title text-xl pt-4">Quy tắc phát âm đuôi -ed</h2>
          <div className="overflow-x-auto">
            <table className="ui-table w-full text-sm">
              <thead><tr><th>Cách đọc</th><th>Khi từ gốc tận cùng bằng</th><th>Ví dụ</th></tr></thead>
              <tbody>
                <tr><td><b>/ɪd/</b></td><td>Âm /t/, /d/</td><td>wanted, needed, decided, visited</td></tr>
                <tr><td><b>/t/</b></td><td>Âm vô thanh /p/, /k/, /f/, /s/, /ʃ/, /tʃ/, /θ/ — thường viết là p, k, f, gh, ph, s, ss, x, ce, sh, ch</td><td>stopped, looked, laughed, missed, fixed, danced, washed, watched</td></tr>
                <tr><td><b>/d/</b></td><td>Nguyên âm và các phụ âm hữu thanh còn lại</td><td>played, cleaned, lived, changed, studied, raised</td></tr>
              </tbody>
            </table>
          </div>
          <p><b>Câu thần chú -ed:</b> &ldquo;<b>Kh</b>i <b>S</b>ang <b>S</b>ông <b>Ph</b>ải <b>Ch</b>ờ <b>Th</b>u <b>Ph</b>í&rdquo; → k, s, sh, p, ch, th, f đọc <b>/t/</b>. Nhớ thêm: tận cùng t, d đọc <b>/ɪd/</b>; còn lại đọc <b>/d/</b>.</p>

          <h2 className="ui-section-title text-xl pt-4">Quy tắc phát âm đuôi -s/-es</h2>
          <div className="overflow-x-auto">
            <table className="ui-table w-full text-sm">
              <thead><tr><th>Cách đọc</th><th>Khi từ gốc tận cùng bằng</th><th>Ví dụ</th></tr></thead>
              <tbody>
                <tr><td><b>/ɪz/</b></td><td>Âm gió /s/, /z/, /ʃ/, /ʒ/, /tʃ/, /dʒ/ — thường viết là s, ss, x, z, sh, ch, ce, se, ge</td><td>watches, boxes, buses, washes, changes, houses</td></tr>
                <tr><td><b>/s/</b></td><td>Âm vô thanh /p/, /t/, /k/, /f/, /θ/</td><td>books, cats, stops, laughs, months</td></tr>
                <tr><td><b>/z/</b></td><td>Nguyên âm và các phụ âm hữu thanh còn lại</td><td>dogs, pens, plays, trees, clothes</td></tr>
              </tbody>
            </table>
          </div>
          <p><b>Câu thần chú -s/-es:</b> &ldquo;<b>Th</b>ời <b>Ph</b>ong <b>K</b>iến <b>Ph</b>ương <b>T</b>ây&rdquo; → th, p, k, f, t đọc <b>/s/</b>. Âm gió (s, ss, x, z, sh, ch, ce, ge) đọc <b>/ɪz/</b>; còn lại đọc <b>/z/</b>.</p>

          <h2 className="ui-section-title text-xl pt-4">Các ngoại lệ hay gặp trong đề thi</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Tính từ đọc <b>/ɪd/</b>: naked, wicked, beloved, crooked, ragged, sacred, learned, aged, blessed.</li>
            <li>&ldquo;gh&rdquo; đọc /f/: laughed, coughed đọc <b>/t/</b>; laughs, coughs đọc <b>/s/</b>.</li>
            <li>&ldquo;ch&rdquo; đọc /k/: stomachs, monarchs, headaches đọc <b>/s/</b> (không phải /ɪz/).</li>
            <li>houses đọc /ˈhaʊzɪz/; clothes đọc /kləʊðz/; says đọc /sez/; does đọc /dʌz/.</li>
          </ul>
        </article>

        <ToolFaq faqs={FAQS} />
        <ToolCta text="Luyện phát âm cùng AI: ghi âm giọng nói, so khớp với từ mẫu và nhận góp ý sửa lỗi phát âm." />
        <RelatedTools current={PATH} />
      </div>
    </div>
  );
}
