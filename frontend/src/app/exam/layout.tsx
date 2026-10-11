import type { Metadata } from "next";
import { baseOpenGraph } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Làm Bài Thi Thử",
  description:
    "Làm thử bài trắc nghiệm tiếng Anh ở chế độ luyện tập (phản hồi ngay) hoặc chế độ thi (nộp xong mới xem kết quả).",
  // Trang cần đăng nhập (hoặc chỉ có dữ liệu mẫu): Googlebot chỉ thấy trang rỗng/bị chuyển hướng → không index,
  // vẫn follow để link trên trang được tính. Không chặn ở robots.ts (chặn thì Google không đọc được thẻ noindex).
  robots: { index: false, follow: true },
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
