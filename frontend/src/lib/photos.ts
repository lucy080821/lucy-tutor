// Ảnh người thật (đã tách nền, PNG trong suốt → WebP có alpha) cho trang chủ và banner các trang công cụ miễn phí.
// Phong cách: ảnh lớn đặt trên khối màu navy/xanh nhạt + thẻ nổi (giống landing page luyện thi), cùng 1 bộ ảnh
// (tác giả Yohanesnvl, áo xanh hợp bảng màu #1E3A8A). SEO: alt tiếng Việt, tên file theo từ khoá, có trong OpenGraph,
// JSON-LD và sitemap ảnh. Nguồn: Pixabay (Pixabay Content License — dùng thương mại, không bắt buộc ghi nguồn).
// File đã TẢI VỀ public/images/photos/ (Pixabay không cho hotlink lâu dài), cắt sát viền trong suốt, cao ≤900px, WebP q78.
export type Photo = {
  src: string;
  alt: string;
  width: number;
  height: number;
  source: string;
};

const p = (file: string, alt: string, width: number, height: number, source: string): Photo => ({
  src: `/images/photos/${file}.webp`, alt, width, height, source,
});

export const PHOTOS = {
  homeCta: p("hoc-vien-dat-muc-tieu-tieng-anh", "Học viên vui mừng giơ cúp khi đạt mục tiêu điểm tiếng Anh", 567, 678,
    "https://pixabay.com/photos/woman-trophy-celebrating-joy-10505406/"),
  homeFaq: p("hoc-vien-hoi-dap-lucy-tutor", "Học viên ngồi xếp bằng, đưa tay giới thiệu phần hỏi đáp về Lucy Tutor", 490, 630,
    "https://pixabay.com/photos/woman-sitting-person-blue-shirt-10505407/"),
  placement: p("kiem-tra-trinh-do-tieng-anh-online", "Học viên mỉm cười giới thiệu bài kiểm tra trình độ tiếng Anh online miễn phí", 629, 668,
    "https://pixabay.com/photos/woman-portrait-smile-posing-10505422/"),
  writing: p("cham-bai-writing-tieng-anh", "Học viên đang viết bài luận tiếng Anh vào sổ để AI chấm điểm", 743, 720,
    "https://pixabay.com/photos/woman-notebook-writing-smile-10505440/"),
  ielts: p("tinh-diem-ielts-band", "Học viên cầm máy tính bảng xem biểu đồ điểm IELTS band", 708, 686,
    "https://pixabay.com/photos/woman-smiling-hijab-tablet-10505421/"),
  pronunciation: p("luyen-phat-am-tieng-anh", "Học viên khum tay nói to luyện phát âm tiếng Anh", 493, 666,
    "https://pixabay.com/photos/woman-hijab-young-woman-smiling-10505412/"),
  flashcard: p("flashcard-tu-vung-tieng-anh", "Học viên cầm xấp thẻ màu như bộ flashcard từ vựng tiếng Anh", 839, 689,
    "https://pixabay.com/photos/woman-smile-color-swatch-10505432/"),
  irregularVerbs: p("bang-dong-tu-bat-quy-tac", "Học viên ghi chép bảng động từ bất quy tắc trên máy tính bảng", 829, 657,
    "https://pixabay.com/photos/woman-art-tablet-drawing-10505431/"),
  blog: p("blog-chia-se-kinh-nghiem-hoc-tieng-anh", "Học viên ngồi đọc sách — blog chia sẻ kinh nghiệm học Tiếng Anh", 701, 900,
    "https://pixabay.com/photos/woman-girl-people-isolated-face-5309387/"),
  blogEmpty: p("blog-chua-co-bai-viet", "Học viên đeo kính đứng chờ bài viết mới", 390, 656,
    "https://pixabay.com/photos/woman-glasses-blue-shirt-pants-10505398/"),
} satisfies Record<string, Photo>;

/** Ảnh bìa dự phòng cho bài blog chưa có ảnh bìa (thẻ bài viết, mục "Bài mới" ở dashboard). */
export const BLOG_FALLBACK_COVER = "/images/photos/home/blog-anh-bia-mac-dinh.webp";
