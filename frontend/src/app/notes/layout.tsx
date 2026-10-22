import type { Metadata } from "next";
import { baseOpenGraph } from "@/lib/seo";

// Sổ ghi chú cần đăng nhập → noindex (Googlebot chỉ thấy trang chuyển hướng). Trang giới thiệu công khai để lên
// Google là /ghi-chu-ai. Không chặn ở robots.ts (chặn thì Google không đọc được thẻ noindex).
export const metadata: Metadata = {
  title: "Ghi Chú",
  description: "Sổ ghi chú Lucy Notes: ghi mọi thứ, ghi âm thành ghi chú, tự tạo flashcard và hỏi lại chính sổ ghi chú của bạn.",
  robots: { index: false, follow: true },
  openGraph: {
    ...baseOpenGraph,
    title: "Ghi Chú | Lucy Tutor",
    description: "Sổ ghi chú Lucy Notes: ghi mọi thứ, ghi âm thành ghi chú, tự tạo flashcard và hỏi lại chính sổ ghi chú của bạn.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
