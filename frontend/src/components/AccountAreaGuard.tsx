"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getSessionRole, getSessionUserId } from "@/lib/session";

// Tài khoản Ghi chú (role NOTES, tạo ở /notes) chỉ dùng cho Lucy Notes: mở trang thuộc app học (dashboard, luyện tập,
// bài thi…) thì đưa về /notes. Trang công khai (trang chủ, blog, công cụ miễn phí) vẫn xem bình thường.
// Backend còn chặn thêm: /api/auth/signin từ chối role NOTES. Mount 1 lần ở app/layout.tsx.
const LEARNING_AREAS = ["/dashboard", "/teacher", "/gym", "/grammar-gym", "/reading", "/writing", "/listening", "/conversation",
  "/pronunciation", "/mock-test", "/ielts", "/study-plan", "/mistakes", "/exam/", "/lesson/"];

export default function AccountAreaGuard() {
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (!pathname || !getSessionUserId() || getSessionRole() !== "NOTES") return;
    if (LEARNING_AREAS.some((p) => pathname === p || pathname.startsWith(p.endsWith("/") ? p : `${p}/`))) router.replace("/notes");
  }, [pathname, router]);
  return null;
}
