import type { Metadata } from "next";
import { baseOpenGraph } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Luyện Nói Cùng AI",
  description:
    "Luyện nói tiếng Anh với AI theo chủ đề hoặc ngữ cảnh tự chọn, phù hợp cấp độ CEFR, kèm nhận xét cuối buổi về độ trôi chảy, từ vựng và ngữ pháp.",
  alternates: { canonical: "/conversation" },
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
