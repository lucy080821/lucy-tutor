import { getFlashGrades } from "@/lib/tools/flashcards";

// Từ vựng SGK lớp 1–12 cho game Qilin Run (public/games/qilin-run/play.html tự tải lúc mở game).
// Cùng nguồn với trang /flashcard-tieng-anh (GET /api/free-tools/flashcards của backend) nên giáo viên thêm từ
// thì game có theo. Dạng: { "1": [{ label, title, cards: [{ en, vi, phonetic, example }] }], ... }
//
// Không dùng `force-static` nữa: bản tĩnh dựng lúc build từng bị đóng băng rỗng 1 giờ khi backend đang khởi động
// lại (14/11/2026). Handler chạy mỗi request nhưng dữ liệu vẫn được cache qua fetch trong `getFlashGrades`
// (1 giờ khi có từ, 5 phút khi rỗng), nên backend không bị gọi dồn.
export const dynamic = "force-dynamic";

export async function GET() {
  const grades = await getFlashGrades();
  const out: Record<string, { label: string; title: string; cards: { en: string; vi: string; phonetic: string; example: string }[] }[]> = {};
  let total = 0;
  for (const g of grades) {
    out[g.grade] = g.units.map((u) => ({
      label: u.label,
      title: u.title,
      cards: u.cards.map((c) => { total++; return { en: c.en, vi: c.vi, phonetic: c.phonetic || "", example: c.example || "" }; }),
    }));
  }
  return Response.json(out, {
    headers: { "Cache-Control": total > 0 ? "public, max-age=300, stale-while-revalidate=3600" : "no-store" },
  });
}
