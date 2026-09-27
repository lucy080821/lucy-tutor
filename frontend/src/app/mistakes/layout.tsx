import type { Metadata } from "next";
import { baseOpenGraph } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Sổ Tay Lỗi Sai",
  description:
    "Sổ tay tự động lưu các câu làm sai sau mỗi bài thi, lọc theo chuyên đề và xuất PDF để ôn tập lại.",
  alternates: { canonical: "/mistakes" },
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
