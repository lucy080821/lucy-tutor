"use client";

import { useEffect } from "react";

// Hiệu ứng "hiện dần khi cuộn tới" cho landing page: phần tử gắn data-reveal ("up" mặc định | "zoom" | "left" | "right")
// được thêm class is-visible khi lọt vào màn hình. CSS trong globals.css (khối "Landing motion") chỉ ẩn phần tử khi
// <html> có class lp-motion — class này do chính component thêm vào sau khi JS chạy, nên không có JS (bot, JS lỗi)
// thì nội dung vẫn hiện đầy đủ. Người dùng bật "giảm chuyển động" ở hệ điều hành thì bỏ qua toàn bộ hiệu ứng.
export default function ScrollReveal() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    const root = document.documentElement;
    const items = document.querySelectorAll<HTMLElement>("[data-reveal]");

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );
    items.forEach((el) => {
      // Phần tử đã nằm trên vùng nhìn thấy (vd mở thẳng /#lien-he rồi cuộn lên) thì hiện luôn, không ẩn rồi hiện lại
      if (el.getBoundingClientRect().bottom < 0) el.classList.add("is-visible");
      else observer.observe(el);
    });
    root.classList.add("lp-motion");

    return () => {
      observer.disconnect();
      root.classList.remove("lp-motion");
    };
  }, []);
  return null;
}
