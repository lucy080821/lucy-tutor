import { pageMetadata } from "@/lib/seo";
import { ToolJsonLd } from "@/components/tools/ToolPage";

// Từ khoá chính: "trò chơi tiếng anh lớp 3"
// Từ khoá phụ: trò chơi tiếng anh lớp 3 miễn phí, game tiếng anh lớp 3 global success, trò chơi tiếng anh cho bé lớp 3,
// game tiếng anh online miễn phí, game tiếng anh vừa học vừa chơi
const PATH = "/games/lop-3";
const TITLE = "Trò Chơi Tiếng Anh Lớp 3 Miễn Phí – Global Success";
const DESCRIPTION =
  "5 trò chơi tiếng Anh lớp 3 miễn phí theo sách Global Success (Starter đến Unit 9): lật thẻ ghép cặp, ong đánh vần, xếp câu, đua với thời gian, nghe và chọn. Vừa học vừa chơi, không cần đăng nhập.";

export const metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: PATH,
  keywords: [
    "trò chơi tiếng anh lớp 3", "trò chơi tiếng anh lớp 3 miễn phí", "game tiếng anh lớp 3", "game tiếng anh lớp 3 global success",
    "trò chơi tiếng anh cho bé lớp 3", "game tiếng anh online miễn phí", "game tiếng anh vừa học vừa chơi",
  ],
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ToolJsonLd name={TITLE} path={PATH} description={DESCRIPTION} category="GameApplication"
        crumbs={[{ name: "Trò chơi tiếng Anh lớp 3", href: PATH }]} />
      {children}
    </>
  );
}
