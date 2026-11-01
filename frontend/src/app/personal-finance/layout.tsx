import type { Metadata } from "next";

// Sổ thu chi cá nhân của quản trị viên — riêng tư, không cho công cụ tìm kiếm lập chỉ mục.
export const metadata: Metadata = {
  title: "Thu Chi Cá Nhân",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
