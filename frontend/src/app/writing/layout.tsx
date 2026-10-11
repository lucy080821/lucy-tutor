import type { Metadata } from "next";
import { baseOpenGraph } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Luyện Viết Tiếng Anh",
  description:
    "Luyện viết tiếng Anh với đề do AI tạo theo cấp độ CEFR và mục tiêu IELTS/giao tiếp, nhận xét chi tiết về ngữ pháp, từ vựng, bố cục và độ dễ đọc.",
  // Trang cần đăng nhập (hoặc chỉ có dữ liệu mẫu): Googlebot chỉ thấy trang rỗng/bị chuyển hướng → không index,
  // vẫn follow để link trên trang được tính. Không chặn ở robots.ts (chặn thì Google không đọc được thẻ noindex).
  robots: { index: false, follow: true },
  openGraph: {
    ...baseOpenGraph,
    title: "Luyện Viết Tiếng Anh | Lucy Tutor",
    description:
      "Luyện viết tiếng Anh với đề do AI tạo theo cấp độ CEFR và mục tiêu IELTS/giao tiếp, nhận xét chi tiết về ngữ pháp, từ vựng, bố cục và độ dễ đọc.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
