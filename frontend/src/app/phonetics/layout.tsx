import type { Metadata } from "next";
import { baseOpenGraph } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Bảng Phiên Âm IPA",
  description:
    "Bảng 44 âm tiếng Anh (IPA) theo bố cục Adrian Underhill: bấm để nghe từng âm, xem cách phát âm và phân biệt âm hữu thanh/vô thanh.",
  alternates: { canonical: "/phonetics" },
  openGraph: {
    ...baseOpenGraph,
    title: "Bảng Phiên Âm IPA | Lucy Tutor",
    description:
      "Bảng 44 âm tiếng Anh (IPA) theo bố cục Adrian Underhill: bấm để nghe từng âm, xem cách phát âm và phân biệt âm hữu thanh/vô thanh.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
