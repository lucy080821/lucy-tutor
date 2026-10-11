import type { Metadata } from "next";
import { baseOpenGraph } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Luyện Nói Cùng AI",
  description:
    "Luyện nói tiếng Anh với AI theo chủ đề hoặc ngữ cảnh tự chọn, phù hợp cấp độ CEFR, kèm nhận xét cuối buổi về độ trôi chảy, từ vựng và ngữ pháp.",
  // Trang cần đăng nhập (hoặc chỉ có dữ liệu mẫu): Googlebot chỉ thấy trang rỗng/bị chuyển hướng → không index,
  // vẫn follow để link trên trang được tính. Không chặn ở robots.ts (chặn thì Google không đọc được thẻ noindex).
  robots: { index: false, follow: true },
  openGraph: {
    ...baseOpenGraph,
    title: "Luyện Nói Cùng AI | Lucy Tutor",
    description:
      "Luyện nói tiếng Anh với AI theo chủ đề hoặc ngữ cảnh tự chọn, phù hợp cấp độ CEFR, kèm nhận xét cuối buổi về độ trôi chảy, từ vựng và ngữ pháp.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
