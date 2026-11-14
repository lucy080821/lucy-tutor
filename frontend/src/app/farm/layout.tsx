import type { Metadata } from "next";
import { baseOpenGraph } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Nông Trại Qilin — Game học từ vựng kiểu Hay Day",
  description:
    "Trồng từ vựng tiếng Anh, cây chín theo lịch ôn SRS, thu hoạch bằng trí nhớ, giao đơn hàng cho khách, nuôi Qilin con và trang trí nông trại của riêng bạn.",
  // Trang cần đăng nhập → không index, vẫn follow (cùng quy ước /gym).
  robots: { index: false, follow: true },
  openGraph: {
    ...baseOpenGraph,
    title: "Nông Trại Qilin — Game học từ vựng kiểu Hay Day | Lucy Tutor",
    description:
      "Trồng từ vựng tiếng Anh, cây chín theo lịch ôn SRS, thu hoạch bằng trí nhớ, giao đơn hàng cho khách, nuôi Qilin con và trang trí nông trại của riêng bạn.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
