import type { Metadata } from "next";
import { baseOpenGraph } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Luyện Đề IELTS Cambridge",
  description:
    "Luyện đề IELTS Cambridge đủ 4 kỹ năng Listening, Reading, Writing, Speaking, chấm điểm theo band và xem lại lịch sử làm bài.",
  alternates: { canonical: "/ielts" },
  openGraph: {
    ...baseOpenGraph,
    title: "Luyện Đề IELTS Cambridge | Lucy Tutor",
    description:
      "Luyện đề IELTS Cambridge đủ 4 kỹ năng Listening, Reading, Writing, Speaking, chấm điểm theo band và xem lại lịch sử làm bài.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
