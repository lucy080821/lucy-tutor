import type { Metadata } from "next";
import { baseOpenGraph } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Lộ Trình Học Tập",
  description:
    "Lộ trình học tiếng Anh cá nhân hoá, gợi ý nội dung ôn tập ưu tiên dựa trên kết quả học tập của bạn.",
  // Trang cần đăng nhập (hoặc chỉ có dữ liệu mẫu): Googlebot chỉ thấy trang rỗng/bị chuyển hướng → không index,
  // vẫn follow để link trên trang được tính. Không chặn ở robots.ts (chặn thì Google không đọc được thẻ noindex).
  robots: { index: false, follow: true },
  openGraph: {
    ...baseOpenGraph,
    title: "Lộ Trình Học Tập | Lucy Tutor",
    description:
      "Lộ trình học tiếng Anh cá nhân hoá, gợi ý nội dung ôn tập ưu tiên dựa trên kết quả học tập của bạn.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
