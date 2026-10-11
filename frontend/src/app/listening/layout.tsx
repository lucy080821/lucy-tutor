import type { Metadata } from "next";
import { baseOpenGraph } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Luyện Nghe Tiếng Anh",
  description:
    "Luyện nghe tiếng Anh qua audio thật với giọng UK/US/AUS: nghe từ vựng trong ngữ cảnh câu, chép chính tả và làm đề luyện nghe do AI tạo.",
  // Trang cần đăng nhập (hoặc chỉ có dữ liệu mẫu): Googlebot chỉ thấy trang rỗng/bị chuyển hướng → không index,
  // vẫn follow để link trên trang được tính. Không chặn ở robots.ts (chặn thì Google không đọc được thẻ noindex).
  robots: { index: false, follow: true },
  openGraph: {
    ...baseOpenGraph,
    title: "Luyện Nghe Tiếng Anh | Lucy Tutor",
    description:
      "Luyện nghe tiếng Anh qua audio thật với giọng UK/US/AUS: nghe từ vựng trong ngữ cảnh câu, chép chính tả và làm đề luyện nghe do AI tạo.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
