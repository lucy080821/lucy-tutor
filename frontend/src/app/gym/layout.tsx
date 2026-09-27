import type { Metadata } from "next";
import { baseOpenGraph } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Phòng Gym Từ Vựng (SRS)",
  description:
    "Ôn từ vựng tiếng Anh bằng flashcard lặp lại ngắt quãng (SRS, thuật toán SM-2): lật thẻ, gõ đáp án và tự thêm từ mới vào bộ thẻ của bạn.",
  alternates: { canonical: "/gym" },
  openGraph: {
    ...baseOpenGraph,
    title: "Phòng Gym Từ Vựng (SRS) | Lucy Tutor",
    description:
      "Ôn từ vựng tiếng Anh bằng flashcard lặp lại ngắt quãng (SRS, thuật toán SM-2): lật thẻ, gõ đáp án và tự thêm từ mới vào bộ thẻ của bạn.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
