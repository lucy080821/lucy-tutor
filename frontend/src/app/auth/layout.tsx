import type { Metadata } from "next";
import { baseOpenGraph } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Đăng nhập / Đăng ký",
  description:
    "Đăng nhập Lucy Tutor dành cho học sinh và giáo viên, hoặc đăng ký tài khoản học viên để dùng thử miễn phí 3 ngày.",
  alternates: { canonical: "/auth" },
  openGraph: {
    ...baseOpenGraph,
    title: "Đăng nhập / Đăng ký | Lucy Tutor",
    description:
      "Đăng nhập Lucy Tutor dành cho học sinh và giáo viên, hoặc đăng ký tài khoản học viên để dùng thử miễn phí 3 ngày.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
