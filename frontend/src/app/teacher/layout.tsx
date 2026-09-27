import type { Metadata } from "next";

// Khu vực riêng tư theo tài khoản — không cho công cụ tìm kiếm lập chỉ mục.
export const metadata: Metadata = {
  title: "Bảng Điều Khiển Giáo Viên",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
