import { pageMetadata } from "@/lib/seo";
import { ToolJsonLd } from "@/components/tools/ToolPage";

// Từ khoá chính: "bảng phiên âm ipa tiếng anh"
// Từ khoá phụ: bảng ipa 44 âm, bảng ipa và cách đọc, bảng phiên âm tiếng anh quốc tế, bảng ipa đầy đủ, phát âm tiếng anh chuẩn ipa
const PATH = "/phonetics";
const TITLE = "Bảng Phiên Âm IPA Tiếng Anh 44 Âm và Cách Đọc";
const DESCRIPTION =
  "Bảng phiên âm IPA tiếng Anh đầy đủ 44 âm theo bố cục Adrian Underhill: bấm để nghe từng âm, xem cách đặt miệng lưỡi, so sánh với âm tiếng Việt và phân biệt âm hữu thanh, vô thanh. Miễn phí, không cần đăng nhập.";

export const metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: PATH,
  keywords: [
    "bảng phiên âm ipa", "bảng phiên âm ipa tiếng anh", "bảng ipa 44 âm", "bảng ipa và cách đọc", "bảng ipa đầy đủ",
    "bảng phiên âm tiếng anh quốc tế", "bảng phiên âm quốc tế ipa", "phát âm tiếng anh chuẩn ipa",
  ],
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ToolJsonLd name={TITLE} path={PATH} description={DESCRIPTION} crumbs={[{ name: "Bảng phiên âm IPA", href: PATH }]} />
      {children}
    </>
  );
}
