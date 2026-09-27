import type { Metadata } from "next";
import { baseOpenGraph } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Luyện Đọc Hiểu Tiếng Anh",
  description:
    "Luyện đọc hiểu tiếng Anh với bài đọc do AI tạo theo cấp độ CEFR (A1–C1), 10 dạng câu hỏi IELTS, chấm tự động và tra nghĩa từ theo ngữ cảnh.",
  alternates: { canonical: "/reading" },
  openGraph: {
    ...baseOpenGraph,
    title: "Luyện Đọc Hiểu Tiếng Anh | Lucy Tutor",
    description:
      "Luyện đọc hiểu tiếng Anh với bài đọc do AI tạo theo cấp độ CEFR (A1–C1), 10 dạng câu hỏi IELTS, chấm tự động và tra nghĩa từ theo ngữ cảnh.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
