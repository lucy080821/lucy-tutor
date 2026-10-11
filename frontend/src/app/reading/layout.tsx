import type { Metadata } from "next";
import { baseOpenGraph } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Luyện Đọc Hiểu Tiếng Anh",
  description:
    "Luyện đọc hiểu tiếng Anh với bài đọc do AI tạo theo cấp độ CEFR (A1–C1), 10 dạng câu hỏi IELTS, chấm tự động và tra nghĩa từ theo ngữ cảnh.",
  // Trang cần đăng nhập (hoặc chỉ có dữ liệu mẫu): Googlebot chỉ thấy trang rỗng/bị chuyển hướng → không index,
  // vẫn follow để link trên trang được tính. Không chặn ở robots.ts (chặn thì Google không đọc được thẻ noindex).
  robots: { index: false, follow: true },
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
