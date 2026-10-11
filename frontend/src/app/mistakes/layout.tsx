import type { Metadata } from "next";
import { baseOpenGraph } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Sổ Tay Lỗi Sai",
  description:
    "Sổ tay tự động lưu các câu làm sai sau mỗi bài thi, lọc theo chuyên đề và xuất PDF để ôn tập lại.",
  // Trang cần đăng nhập (hoặc chỉ có dữ liệu mẫu): Googlebot chỉ thấy trang rỗng/bị chuyển hướng → không index,
  // vẫn follow để link trên trang được tính. Không chặn ở robots.ts (chặn thì Google không đọc được thẻ noindex).
  robots: { index: false, follow: true },
  openGraph: {
    ...baseOpenGraph,
    title: "Sổ Tay Lỗi Sai | Lucy Tutor",
    description:
      "Sổ tay tự động lưu các câu làm sai sau mỗi bài thi, lọc theo chuyên đề và xuất PDF để ôn tập lại.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
