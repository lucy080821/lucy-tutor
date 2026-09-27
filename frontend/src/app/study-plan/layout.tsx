import type { Metadata } from "next";
import { baseOpenGraph } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Lộ Trình Học Tập",
  description:
    "Lộ trình học tiếng Anh cá nhân hoá, gợi ý nội dung ôn tập ưu tiên dựa trên kết quả học tập của bạn.",
  alternates: { canonical: "/study-plan" },
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
