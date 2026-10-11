import type { Metadata } from "next";
import { baseOpenGraph } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Đề Thi Thử THPT Quốc Gia Tiếng Anh",
  description:
    "Làm đề thi thử Tiếng Anh THPT Quốc Gia do AI tạo theo đúng cấu trúc đề thật: ngữ âm, ngữ pháp, giao tiếp, đọc điền từ, đọc hiểu, có tính giờ và phân tích sau khi nộp.",
  // Trang cần đăng nhập (hoặc chỉ có dữ liệu mẫu): Googlebot chỉ thấy trang rỗng/bị chuyển hướng → không index,
  // vẫn follow để link trên trang được tính. Không chặn ở robots.ts (chặn thì Google không đọc được thẻ noindex).
  robots: { index: false, follow: true },
  openGraph: {
    ...baseOpenGraph,
    title: "Đề Thi Thử THPT Quốc Gia Tiếng Anh | Lucy Tutor",
    description:
      "Làm đề thi thử Tiếng Anh THPT Quốc Gia do AI tạo theo đúng cấu trúc đề thật: ngữ âm, ngữ pháp, giao tiếp, đọc điền từ, đọc hiểu, có tính giờ và phân tích sau khi nộp.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
