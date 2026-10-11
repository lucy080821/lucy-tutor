import type { Metadata } from "next";
import { baseOpenGraph } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Luyện Phát Âm Cùng AI",
  description:
    "Luyện phát âm tiếng Anh: nghe mẫu, ghi âm giọng đọc, nhận ước lượng mức khớp và góp ý AI về lỗi phát âm thường gặp của người Việt.",
  // Trang cần đăng nhập (hoặc chỉ có dữ liệu mẫu): Googlebot chỉ thấy trang rỗng/bị chuyển hướng → không index,
  // vẫn follow để link trên trang được tính. Không chặn ở robots.ts (chặn thì Google không đọc được thẻ noindex).
  robots: { index: false, follow: true },
  openGraph: {
    ...baseOpenGraph,
    title: "Luyện Phát Âm Cùng AI | Lucy Tutor",
    description:
      "Luyện phát âm tiếng Anh: nghe mẫu, ghi âm giọng đọc, nhận ước lượng mức khớp và góp ý AI về lỗi phát âm thường gặp của người Việt.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
