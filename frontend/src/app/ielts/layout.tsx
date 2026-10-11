import type { Metadata } from "next";
import { baseOpenGraph } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Luyện Đề IELTS Cambridge",
  description:
    "Luyện đề IELTS Cambridge đủ 4 kỹ năng Listening, Reading, Writing, Speaking, chấm điểm theo band và xem lại lịch sử làm bài.",
  // Trang cần đăng nhập (hoặc chỉ có dữ liệu mẫu): Googlebot chỉ thấy trang rỗng/bị chuyển hướng → không index,
  // vẫn follow để link trên trang được tính. Không chặn ở robots.ts (chặn thì Google không đọc được thẻ noindex).
  robots: { index: false, follow: true },
  openGraph: {
    ...baseOpenGraph,
    title: "Luyện Đề IELTS Cambridge | Lucy Tutor",
    description:
      "Luyện đề IELTS Cambridge đủ 4 kỹ năng Listening, Reading, Writing, Speaking, chấm điểm theo band và xem lại lịch sử làm bài.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
