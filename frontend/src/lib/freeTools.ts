// Danh sách công cụ miễn phí, không cần đăng nhập — dùng chung cho khối "Công cụ miễn phí" ở trang chủ,
// mục "Công cụ khác" cuối mỗi trang công cụ, footer và sitemap. Thêm công cụ mới: thêm 1 dòng ở đây.
export type FreeTool = {
  href: string;
  title: string;
  desc: string;
  thumb: string;
  alt: string;
  tag: string;
};

export const FREE_TOOLS: FreeTool[] = [
  {
    href: "/kiem-tra-trinh-do-tieng-anh",
    title: "Kiểm Tra Trình Độ Tiếng Anh",
    desc: "30 câu trắc nghiệm, khoảng 15 phút, biết ngay trình độ CEFR A1–C1 và kỹ năng cần cải thiện.",
    thumb: "/images/photos/home/kiem-tra-trinh-do-tieng-anh.webp",
    alt: "Học sinh suy nghĩ khi làm bài kiểm tra trình độ tiếng Anh trên máy tính",
    tag: "CEFR A1–C1",
  },
  {
    href: "/cham-writing-mien-phi",
    title: "Chấm Writing Miễn Phí Bằng AI",
    desc: "Dán bài IELTS Task 1, Task 2 hoặc đoạn văn — AI ước tính band theo 4 tiêu chí và sửa lỗi từng câu.",
    thumb: "/images/photos/home/cham-bai-viet-tieng-anh.webp",
    alt: "Giáo viên dùng bút đánh dấu lỗi khi chấm bài viết tiếng Anh",
    tag: "AI · IELTS",
  },
  {
    href: "/ielts-band-calculator",
    title: "Tính Điểm IELTS (Band Calculator)",
    desc: "Quy đổi số câu đúng Listening, Reading ra band và tính điểm Overall theo quy tắc làm tròn IELTS.",
    thumb: "/images/photos/home/may-tinh-diem-ielts.webp",
    alt: "Máy tính và bút trên bàn học để tính điểm IELTS",
    tag: "IELTS",
  },
  {
    href: "/cach-phat-am-ed-s-es",
    title: "Cách Phát Âm Đuôi -ed, -s/-es",
    desc: "Gõ từ bất kỳ để biết đọc /t/, /d/, /ɪd/ hay /s/, /z/, /ɪz/ — kèm mẹo ghi nhớ và bài luyện kiểu đề THPT.",
    thumb: "/images/photos/home/luyen-phat-am-duoi-ed-s.webp",
    alt: "Bạn nhỏ nói vào điện thoại lon — luyện phát âm đuôi ed và s es",
    tag: "Ngữ âm",
  },
  {
    href: "/flashcard-tieng-anh",
    title: "Flashcard Tiếng Anh Lớp 1–12",
    desc: "Thẻ từ vựng theo từng Unit sách Global Success: lật thẻ, nghe phát âm và tải PDF để in.",
    thumb: "/images/photos/home/flashcard-bang-chu-cai.webp",
    alt: "Bảng chữ cái tiếng Anh nhiều màu — flashcard từ vựng",
    tag: "Tải PDF",
  },
  {
    href: "/bang-dong-tu-bat-quy-tac",
    title: "Bảng Động Từ Bất Quy Tắc",
    desc: "Hơn 150 động từ bất quy tắc V1 – V2 – V3 kèm nghĩa: tra nhanh, nghe phát âm, luyện tập và tải PDF.",
    thumb: "/images/photos/home/bang-dong-tu-tieng-anh.webp",
    alt: "Bảng đen ghi verbs, nouns, adjectives — học động từ bất quy tắc tiếng Anh",
    tag: "Ngữ pháp",
  },
  {
    href: "/ghi-chu-ai",
    title: "Ghi Chú AI Miễn Phí",
    desc: "Sổ ghi chú online không cần đăng nhập: ghi âm thành ghi chú, tự tạo flashcard, hỏi lại chính sổ ghi chú của bạn.",
    thumb: "/images/photos/home/ghi-chu-ai-ghi-am-flashcard.webp",
    alt: "Giao diện Lucy Notes: bài giảng ghi âm có mốc thời gian, việc cần làm và hỏi sổ ghi chú",
    tag: "AI · Ghi chú",
  },
  {
    href: "/phonetics",
    title: "Bảng Phiên Âm IPA 44 Âm",
    desc: "Bảng IPA theo bố cục Adrian Underhill: bấm để nghe từng âm và xem cách đặt miệng, lưỡi.",
    thumb: "/images/photos/home/tu-dien-phien-am-ipa.webp",
    alt: "Trang từ điển tiếng Anh có phiên âm IPA",
    tag: "IPA",
  },
  {
    href: "/games/lop-3",
    title: "Trò Chơi Tiếng Anh Lớp 3",
    desc: "5 trò chơi ôn từ vựng, mẫu câu Global Success 3: lật thẻ, đánh vần, xếp câu, nghe và chọn.",
    thumb: "/images/photos/home/tre-em-hoc-tieng-anh-tren-may-tinh-bang.webp",
    alt: "Bé gái vui vẻ chơi trò chơi học tiếng Anh trên máy tính bảng",
    tag: "Tiểu học",
  },
];
