import { BlogStatsProvider } from "@/components/blog/BlogStats";

// Bọc mọi trang /blog để lượt xem/click của các bài đang hiện tự làm mới (gần real-time). Không khai báo metadata —
// từng trang con tự export metadata/generateMetadata.
export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return <BlogStatsProvider>{children}</BlogStatsProvider>;
}
