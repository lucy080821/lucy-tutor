import type { Metadata } from "next";
import { baseOpenGraph } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Grammar Gym – Luyện Ngữ Pháp",
  description:
    "Luyện ngữ pháp tiếng Anh theo chuyên đề, tập trung vào những lỗi bạn hay mắc, kết hợp ôn tập lặp lại ngắt quãng.",
  alternates: { canonical: "/grammar-gym" },
  openGraph: {
    ...baseOpenGraph,
    title: "Grammar Gym – Luyện Ngữ Pháp | Lucy Tutor",
    description:
      "Luyện ngữ pháp tiếng Anh theo chuyên đề, tập trung vào những lỗi bạn hay mắc, kết hợp ôn tập lặp lại ngắt quãng.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
