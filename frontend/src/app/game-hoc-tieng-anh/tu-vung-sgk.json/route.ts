import { getFlashGrades } from "@/lib/tools/flashcards";

// Từ vựng SGK lớp 1–12 cho game Qilin Run (public/games/qilin-run/play.html tự tải lúc mở game).
// Cùng nguồn với trang /flashcard-tieng-anh (GET /api/free-tools/flashcards của backend) nên giáo viên thêm từ
// thì game có theo. Dạng: { "1": [{ label, title, cards: [{ en, vi, phonetic, example }] }], ... }
export const dynamic = "force-static";
export const revalidate = 3600;

export async function GET() {
  const grades = await getFlashGrades();
  const out: Record<string, { label: string; title: string; cards: { en: string; vi: string; phonetic: string; example: string }[] }[]> = {};
  for (const g of grades) {
    out[g.grade] = g.units.map((u) => ({
      label: u.label,
      title: u.title,
      cards: u.cards.map((c) => ({ en: c.en, vi: c.vi, phonetic: c.phonetic || "", example: c.example || "" })),
    }));
  }
  return Response.json(out);
}
