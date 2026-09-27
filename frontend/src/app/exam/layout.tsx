import type { Metadata } from "next";
import { baseOpenGraph } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Làm Bài Thi Thử",
  description:
    "Làm thử bài trắc nghiệm tiếng Anh ở chế độ luyện tập (phản hồi ngay) hoặc chế độ thi (nộp xong mới xem kết quả).",
  alternates: { canonical: "/exam" },
  openGraph: {
    ...baseOpenGraph,
    title: "Làm Bài Thi Thử | Lucy Tutor",
    description:
      "Làm thử bài trắc nghiệm tiếng Anh ở chế độ luyện tập (phản hồi ngay) hoặc chế độ thi (nộp xong mới xem kết quả).",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
