// Chọn công cụ miễn phí liên quan cho 1 bài blog (khối "Công cụ miễn phí liên quan" cuối bài /blog/[slug]).
// Mục đích SEO: bài blog đang xếp hạng tốt (Search Console 10/2026: vị trí 1–8) nhưng chưa link sang trang công cụ
// nào → link nội bộ theo ngữ cảnh giúp trang công cụ lên hạng. Chạy phía server, không gọi API.
// Thêm công cụ mới vào FREE_TOOLS thì thêm 1 dòng từ khoá ở TOOL_KEYWORDS (không có dòng = không bao giờ được gợi ý).
import { FREE_TOOLS, type FreeTool } from "@/lib/freeTools";

// So khớp trên chữ đã bỏ dấu + viết thường (xem normalize) nên từ khoá viết không dấu
const TOOL_KEYWORDS: Record<string, string[]> = {
  "/cach-phat-am-ed-s-es": ["am cuoi", "nuot am", "duoi ed", "duoi -ed", "duoi s", "duoi -s", "/iz/", "/id/", "so nhieu", "qua khu don"],
  "/phonetics": ["phat am", "phien am", "ipa", "schwa", "nguyen am", "phu am", "trong am", "am tiet"],
  "/kiem-tra-trinh-do-tieng-anh": ["trinh do", "cefr", "muc tieu", "lo trinh", "mat goc", "nguoi moi bat dau", "a1", "b1", "b2"],
  "/cham-writing-mien-phi": ["writing", "bai viet", "luyen viet", "nhat ky", "doan van", "essay", "sua loi viet"],
  "/ielts-band-calculator": ["ielts", "band"],
  "/bang-dong-tu-bat-quy-tac": ["dong tu bat quy tac", "phrasal verb", "dong tu", "v2", "v3", "qua khu"],
  "/flashcard-tieng-anh": ["tu vung", "flashcard", "lap lai ngat quang", "spaced repetition", "tu dien", "ghi nho tu"],
  // Không dùng "tieu hoc": bỏ dấu thì "mục tiêu học" cũng thành "muc tieu hoc"
  "/games/lop-3": ["lop 3", "hoc sinh tieu hoc", "bac tieu hoc", "tre em", "be hoc", "tro choi"],
};

// Bài không khớp gì → gợi ý công cụ phổ biến nhất
const FALLBACK = ["/kiem-tra-trinh-do-tieng-anh", "/flashcard-tieng-anh", "/phonetics"];

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

// Đếm số lần xuất hiện nguyên từ/cụm từ ("a1" không khớp trong "ba1", "band" không khớp "bandwidth").
// Không dùng regex lookbehind (Safari < 16.4) dù file chỉ chạy phía server, phòng khi bị import ở client.
const isWordChar = (c: string | undefined) => !!c && /[a-z0-9]/.test(c);
const countOf = (text: string, kw: string) => {
  let n = 0;
  for (let i = text.indexOf(kw); i !== -1; i = text.indexOf(kw, i + kw.length)) {
    if (!isWordChar(text[i - 1]) && !isWordChar(text[i + kw.length])) n++;
  }
  return n;
};

export function pickToolsForPost(
  post: { title: string; tags: string[]; excerpt?: string | null; contentText: string },
  limit = 3,
): FreeTool[] {
  // Tiêu đề + thẻ là tín hiệu chủ đề mạnh nhất → nhân trọng số; nội dung tính tối đa 5 lần/từ khoá để bài dài không lấn át
  const head = normalize(` ${post.title} ${post.tags.join(" ")} ${post.excerpt ?? ""} `);
  const body = normalize(` ${post.contentText} `);
  const scored = Object.entries(TOOL_KEYWORDS)
    .map(([href, kws]) => ({
      href,
      score: kws.reduce((sum, kw) => sum + countOf(head, kw) * 5 + Math.min(countOf(body, kw), 5), 0),
    }))
    .filter((t) => t.score >= 2)
    .sort((a, b) => b.score - a.score)
    .map((t) => t.href);

  const hrefs = [...new Set([...scored, ...FALLBACK])].slice(0, limit);
  return hrefs.map((h) => FREE_TOOLS.find((t) => t.href === h)).filter((t): t is FreeTool => !!t);
}
