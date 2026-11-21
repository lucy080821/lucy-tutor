# Blog tự động — quy trình viết & đăng bài (Lucy Tutor)

Mục tiêu: **mỗi ngày thứ 2 → thứ 6 lúc 05:00 giờ Việt Nam tự đăng 1 bài blog học tiếng Anh chuẩn SEO**, liên tục cho đến khi chủ dự án báo ngưng.
Tác giả đứng tên: **Leo Harrison** (`authorSlug = leo-harrison`), thương hiệu trên ảnh: "Tiếng Anh Không Khó".

## Cơ chế đăng (không cần đăng nhập, không cần cron)

```
backend/content/blog/posts/<slug>/post.json + content.html   ← nội dung bài
frontend/public/images/blog/<slug>/<từ-khoá>-thumbnail.png + -infographic.png   ← ảnh
        │  push lên main → Hostinger deploy → server khởi động
        ▼
backend/src/utils/blogContentSync.js   (chạy 20 giây sau khi server khởi động)
        │  tạo BlogPost: status PUBLISHED, publishedAt = post.json "publishAt" (05:00 +07:00)
        ▼
Trang công khai chỉ hiện bài khi publishedAt <= bây giờ  →  tới 05:00 là bài tự xuất hiện (ISR làm mới trong ≤60 giây)
```

- **Chỉ tạo bài chưa có** (so theo slug). Bài đã có — kể cả đã sửa trong `/teacher/blog` — **không bao giờ bị ghi đè**. Muốn sửa bài đã đăng: sửa trong trình soạn bài, không sửa file.
- Chạy tay / thử: `cd backend && node scripts/importBlogContent.js --dry-run` (liệt kê bài sẽ tạo) rồi bỏ `--dry-run`.
- Tắt hẳn việc tự nhập: đặt biến môi trường `BLOG_CONTENT_SYNC=off`. Bỏ qua 1 bài: thêm `"draft": true` vào `post.json`.
- Không thấy tác giả `leo-harrison` (tài khoản GIÁO VIÊN có `authorSlug` này) thì bỏ qua và ghi log `[blog-sync]` — không làm hỏng server.
- **Âm thanh "Nghe bài viết"** có sẵn cho mọi bài (`BlogAudioPlayer`, giọng ElevenLabs tạo khi có người bấm nghe, cache lại). Trình phát chỉ đọc `h1–h4, p, li, blockquote` — **bảng và infographic KHÔNG được đọc**, nên thông tin quan trọng trong bảng phải có thêm 1 câu tóm tắt trong đoạn văn.

## Quy trình mỗi tuần (routine)

1. `git pull`, đọc `existing-posts.json` + `posts/*/post.json` để biết đã viết gì. Lấy 5 khung giờ: `node backend/content/blog/tools/next-slots.js 5`.
2. Chọn 5 chủ đề `status: "planned"` có `priority` nhỏ nhất trong `topics.json` (đủ thì nghiên cứu thêm chủ đề mới theo cách bên dưới). **Kiểm lại** bằng tìm kiếm: từ khoá chính còn hợp lý không, 3 bài đối thủ đầu trang 1 viết gì → chọn góc rõ hơn/ít khô khan hơn. Không trùng từ khoá chính với bài đã có (tránh tự cạnh tranh).
3. Với mỗi bài tạo thư mục `posts/<slug>/` gồm `content.html` + `post.json` (xem bài mẫu `posts/cac-thi-trong-tieng-anh/`).
4. `node backend/content/blog/tools/render-images.js <slug>` dựng thumbnail + infographic, **mở ảnh ra xem** (chữ không tràn/lẻ dòng).
5. `node backend/content/blog/tools/validate.js` phải ra **0 lỗi, 0 cảnh báo**.
6. Cập nhật `topics.json` (`status: "done"`, `publishAt`). Commit `content(blog): tuần <ngày> — 5 bài` và push `main` (chỉ file nội dung, không sửa code).
7. Chủ dự án nhắn "ngưng" → xoá routine (không xoá bài đã đăng).

## Chuẩn bài (validate.js kiểm tự động)

- **Từ khoá**: 1 từ khoá chính + 3–5 từ khoá phụ (lấy từ gợi ý tìm kiếm/kết quả đối thủ, không bịa số lượt tìm). Từ khoá chính có trong: slug, tiêu đề (đứng đầu), metaTitle, metaDescription, excerpt, 120 từ đầu (in đậm), ≥1 H2, thẻ, **tên file 2 ảnh và alt 2 ảnh**. Từ khoá phụ rải trong H2/H3/thân bài. Mật độ tự nhiên (6+ lần, <2,5%).
- **Độ dài**: ≥1.500 từ (thực tế 1.700–2.400). Mở bài bằng câu hỏi/tình huống quen thuộc; ≥5 H2 + H3 cho từng ý nhỏ; có mục **"Câu hỏi thường gặp"** (H2 + ≥3 H3), một **bài tập nhỏ có đáp án** (nếu chủ đề cho phép), **"Lời kết"**, và khối CTA cuối bài dạng `<blockquote><strong>…<a href="/công-cụ">…</a>…</strong></blockquote>` dẫn tới công cụ/tính năng của Lucy Tutor.
- **Link nội bộ ≥3** (bài cũ `/blog/<slug>`, công cụ `/gym`, `/grammar-gym`, `/cham-writing-mien-phi`, `/cach-phat-am-ed-s-es`, `/phonetics`, …). Không link ngoài trừ khi thật cần và đã kiểm tra còn sống. Không dùng `<h1>` trong thân bài.
- **Ảnh** (cả hai bắt buộc, PNG): thumbnail 1200×630 dùng làm ảnh bìa + OpenGraph; infographic 1080×1350 đặt trong bài tại chỗ `<!--INFOGRAPHIC-->` (đúng 1 chỗ, thường ngay sau phần tổng hợp đầu tiên). **Tên file = `<từ-khoá-chính-không-dấu>-thumbnail.png` / `-infographic.png`**, alt chứa từ khoá và khác nhau. Loại infographic: `steps` (các bước), `table` (bảng so sánh/ma trận; ô có thể ghi `chữ chính||dòng nhỏ`), `timeline`, `formula`, `versus` (sai ↔ đúng). Trong tiêu đề ảnh, `{chữ}` = tô vàng, `**chữ**` = đậm.
- **Lịch**: `publishAt` đúng `…T05:00:00+07:00`, thứ 2–thứ 6, không trùng giờ bài khác.
- `metaTitle` ≤58 ký tự; `metaDescription` 110–160 ký tự; `excerpt` 80–220 ký tự; 6–10 thẻ gồm từ khoá chính; `related` là 3 slug bài liên quan (bài cũ hoặc bài mới).
- Danh mục dùng slug có sẵn trong `existing-posts.json` (`categories`); danh mục mới (vd `luyen-thi-thpt`) tự được tạo khi nhập bài.

## Quy tắc nội dung (giữ chất lượng + trung thực)

- Giọng văn của blog: thân thiện, xưng "mình"–"bạn", câu ngắn, ví dụ tiếng Anh có dịch tiếng Việt, kết bằng "Mình rất sẵn lòng đồng hành cùng bạn!".
- **Không bịa**: không nêu số liệu/nghiên cứu/điểm thi mà chưa kiểm chứng. Thông tin có thể thay đổi (đề thi, thể lệ, giá, tính năng sản phẩm bên thứ ba) phải kiểm lại bằng tìm kiếm trước khi viết, ghi rõ mốc thời gian, và nói rõ chỗ chưa chắc chắn. Phiên âm IPA, công thức ngữ pháp, ví dụ phải đúng.
- Không sao chép đối thủ: dùng họ để biết người đọc đang tìm gì, rồi viết lại bằng cấu trúc và ví dụ riêng.
- Nội dung phải đứng một mình (không cần ảnh mới hiểu) vì audio không đọc bảng/ảnh.

## Nghiên cứu đối thủ (20/11/2026)

SERP tiếng Việt cho chủ đề học tiếng Anh do các site sau chiếm trang 1: `prepedu.com`, `hoanghamobile.com`, `voh.com.vn`, `vietjack.com`, `ielts.idp.com/vietnam`, `britishcouncil.vn`, `mytour.vn`, `zim.vn`, `langmaster.edu.vn`, `vus.edu.vn`, `vnexpress.net`. Điểm yếu chung khai thác được: liệt kê khô (ít "cách nhớ"/quy trình), ít bài tập tự kiểm tra, không có công cụ luyện đi kèm, ít infographic tự vẽ. Lucy Tutor khác biệt nhờ: quy trình từng bước + bài tập có đáp án + infographic + công cụ miễn phí/ôn tập SRS gắn trong bài.
