import type { Metadata } from "next";
import { baseOpenGraph } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Luyện Phát Âm Cùng AI",
  description:
    "Luyện phát âm tiếng Anh: nghe mẫu, ghi âm giọng đọc, nhận ước lượng mức khớp và góp ý AI về lỗi phát âm thường gặp của người Việt.",
  alternates: { canonical: "/pronunciation" },
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
