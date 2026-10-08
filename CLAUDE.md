# Lucy Tutor — Tài liệu dự án

Nền tảng EdTech luyện thi Tiếng Anh dành cho học sinh THPT Việt Nam. Hỗ trợ hai vai trò: **Học sinh** và **Giáo viên**.

---

## Cấu trúc thư mục

```
Lucy Tutor/
├── frontend/          # Next.js 16 + React 19 (UI)
├── backend/           # Express.js + Prisma (API)
├── docker-compose.yml
└── render.yaml        # Cấu hình deploy Render.com
```

---

## Cách chạy dự án

```bash
# Frontend (port 3000)
cd frontend && npm run dev

# Backend (port 5000)
cd backend && npm run dev
```

Biến môi trường frontend: `NEXT_PUBLIC_API_URL` (mặc định `http://localhost:5000`)

---

## Frontend — Cấu trúc giao diện

### Tech stack

| Thư viện | Mục đích |
|---|---|
| Next.js 16 (App Router) | Framework UI |
| React 19 | UI library |
| Tailwind CSS | Styling (class-based) |
| Recharts | Biểu đồ thống kê |
| FullCalendar v6 | Lịch học |
| React Quill New | Rich text editor (soạn câu hỏi) |
| SweetAlert2 | Hộp thoại thông báo/xác nhận |
| jsPDF + html-to-image | Xuất PDF |
| xlsx-js-style | Xuất/nhập Excel |
| JSZip + file-saver | Tải file ZIP |
| canvas-confetti | Hiệu ứng chúc mừng |
| DOMPurify | Sanitize HTML |

### Design system (Tailwind custom tokens)

- `bg-surface` — nền card/panel
- `text-primary` — #1E3A8A
- `text-secondary` — màu phụ
- `text-foreground` — màu chữ chính
- Không dùng glassmorphism (backdrop-blur + border nhạt)

**Phong cách giao diện: theo ieltsonlinetests.com** (giữ màu chủ đạo `#1E3A8A` + logo). Nền trang xám rất nhạt (`bg-background` #f5f7fa), nội dung nằm trong card trắng bo 16px bóng mềm ánh navy, nút dạng pill, bộ lọc/tab dạng chip pill, sidebar dashboard nền **trắng** (không còn sidebar navy đậm), cam `highlight` (#f9a95a) chỉ dùng cho badge "NEW"/1 CTA nổi bật. Token + class dùng chung khai báo trong `globals.css` (`@layer components`, nên class Tailwind utility vẫn override được) — dùng lại thay vì tự viết style mới:
- Token màu: `primary-soft`, `muted`, `line`, `line-strong`, `highlight`; bóng `shadow-card`/`shadow-card-hover`
- Card: `ui-card` (alias `glass`), `ui-card-hover` · Tiêu đề: `ui-page-title`, `ui-page-subtitle`, `ui-section-title` (gạch nhấn ngắn bên dưới)
- Nút: `btn-primary`, `btn-outline`, `btn-ghost`, `btn-highlight` · Chip/tab: `ui-chip` + `ui-chip-active` · Badge: `ui-badge`, `ui-badge-new`
- Form: `ui-input`, `ui-label` · Bảng: `ui-table` · Sidebar: `ui-sidebar`, `ui-nav-group-label`, `ui-nav-item`, `ui-nav-item-active` · Banner navy: `ui-hero`
- Màu trạng thái giữ ngữ nghĩa nhưng dạng nhạt (`bg-emerald-50 text-emerald-700`, `bg-red-50 text-red-700`...); không dùng gradient tím/indigo/hồng trang trí. Recharts: navy `#1E3A8A` chuỗi chính, `#3b82f6` phụ, `#f9a95a` điểm nhấn, `#10b981`/`#ef4444` đúng/sai
- SweetAlert2 được bo 16px + nút pill qua CSS toàn cục (không ép màu nút confirm để giữ nút xoá màu đỏ)
- **Bố cục trang con kiểu IOT**: banner đầu trang (`bg-primary-soft`, dòng breadcrumb "Trang chủ / …" nhỏ, H1 `ui-page-title`, mô tả 1 dòng, thumbnail bên phải chỉ trên desktop) → hàng chip pill → lưới card có thumbnail 16:9 phía trên (danh sách bài học/đề/lớp/tài liệu...). Bảng dữ liệu vẫn giữ dạng bảng. Dashboard giáo viên có helper `PageBanner`/`EmptyState`/`CardThumb` ở cuối `teacher/page.tsx`; dashboard học sinh có `PRACTICE_THUMBS`/`EmptyIllustration`
- **Hạn chế emoji/icon trang trí**: không dùng emoji ở tiêu đề, nhãn tab, sidebar, nút bấm, icon tile trên card/KPI. Chỉ giữ icon có chức năng (play/ghi âm, đóng ×, mũi tên, ✓/✗ đúng sai, ⚠️ cảnh báo, loại file PDF/Word/PPT). Emoji trong dữ liệu gửi API/AI/PDF (`skillIcon`...) và text SweetAlert giữ nguyên
- **Ảnh minh hoạ SVG tự vẽ** (flat, tông navy/xanh/cam, có `<title>` tiếng Việt, 1–5KB mỗi file) trong `frontend/public/images/`: `illustrations/*.svg` (800×600: hero-student, teacher-dashboard, auth-learning, study-progress, faq, contact, empty-state, locked, exam-result) và `thumbs/*.svg` (640×360, 1 file/tính năng: reading, writing, listening, speaking, conversation, vocabulary, grammar, pronunciation, phonetics, mock-test, ielts, exam, lesson, documents, study-plan, mistakes, listening-studio, classroom). Dùng thẻ `<img>` thường (không `next/image`) kèm `alt` tiếng Việt + `width`/`height`, `loading="lazy"` (trừ ảnh hero)

### SEO

- `layout.tsx` gốc: `<html lang="vi">`, metadata đầy đủ (title template `"%s | Lucy Tutor"`, description/keywords tiếng Việt, OpenGraph `vi_VN`, Twitter card). Hằng số dùng chung ở [frontend/src/lib/seo.ts](frontend/src/lib/seo.ts) — **domain lấy từ `NEXT_PUBLIC_SITE_URL`, fallback `https://lucytutor.online` (domain thật)** (ảnh hưởng canonical, sitemap, robots, JSON-LD)
- Vì các page đều `"use client"` (không export được `metadata`), mỗi route có 1 `layout.tsx` pass-through chỉ để khai báo metadata. Trang công khai (auth, 4 kỹ năng, gym, grammar-gym, pronunciation, phonetics, mock-test, ielts, mistakes, study-plan, exam) được index; trang riêng tư (dashboard, teacher, exam/[id], lesson/[id], ielts/[testId], teacher/ielts) đặt `noindex`. Khi set `openGraph` ở layout con phải spread lại `baseOpenGraph` vì Next thay thế nguyên khối chứ không merge
- `sitemap.ts`, `robots.ts` (chặn `/api/`, `/dashboard`, `/teacher`, trang theo id), `opengraph-image.tsx` + `twitter-image.tsx` (ảnh OG 1200×630 sinh bằng `ImageResponse`)
- ⚠️ **Không chạy `next build` khi `next dev` đang chạy** — 2 lệnh dùng chung thư mục `.next`, build sẽ ghi đè cache của dev server gây lỗi hydration mismatch (server HTML mới, client JS cũ). Nếu lỡ gặp: dừng dev server, xoá `frontend/.next`, chạy lại

### Font mặc định

**Calibri** là font duy nhất của toàn app. Được set tại `globals.css` trên cả `html`, `body` và `*, *::before, *::after { font-family: inherit }` để override Tailwind preflight. Không import Google Fonts hay font nào khác.

---

## Các trang (App Router)

### `/` — Trang chủ

**File:** [frontend/src/app/page.tsx](frontend/src/app/page.tsx)

Trang landing page. Hai nút CTA:
- "Dành cho Học Sinh" → `/auth?role=STUDENT`
- "Dành cho Giáo Viên" → `/auth?role=TEACHER`

Hiển thị 8 feature card (`FEATURES`): AI Phân Tích Điểm Yếu, Luyện Phát Âm Cùng AI, Đề Thi Thử THPT Quốc Gia, Biểu Đồ Tiến Độ 4 Kỹ Năng, SRS Vocabulary, Ngân Hàng Câu Hỏi, Gamification & Streak, Dashboard Giáo Viên Pro.

**Không dùng số liệu/testimonial dàn dựng**: trang từng có khối thống kê ảo ("2,400+ học viên", "94% tăng điểm"...) và 3 testimonial hư cấu kèm tên/điểm số cụ thể — đã bỏ hẳn vì app chưa có người dùng thật. Thay vào đó hero hiển thị callout thật: "🎁 Dùng thử miễn phí 3 ngày · Không cần thẻ tín dụng" (khớp với hệ thống dùng thử thật ở mục "Học viên tự do" bên dưới). Badge hero cũng đổi từ "#1 VIỆT NAM" (không có căn cứ) sang "NỀN TẢNG LUYỆN THI TIẾNG ANH TOÀN DIỆN". Nguyên tắc: **không thêm số liệu/lời chứng thực nào chưa được xác thực** vào trang này.

**Bố cục theo trang chủ ieltsonlinetests.com** (server component — không có state, render tĩnh tốt cho SEO): Hero (tiêu đề + CTA + callout dùng thử, ảnh `hero-student.svg` kèm 3 thẻ nổi) → "6 bước chinh phục" (chỉ mô tả tính năng có thật) → lưới luyện tập 8 card có thumbnail (4 kỹ năng + Đề thi thử + IELTS + Ngữ pháp + IPA, thay cho tab 4 kỹ năng cũ) → lộ trình CEFR A1–C1 (từ `CEFR_LEVELS`) → 8 `FEATURES` có thumbnail → khối "Dashboard dành cho Giáo Viên" → FAQ (`<details>`, chỉ trả lời bằng sự thật trong tài liệu này) → khối liên hệ (`section#lien-he`, menu "Liên hệ" ở header global trỏ tới `/#lien-he`; thông tin thật: hotline **0869.603.164**, email **admin@lucytutor.online**) → footer 4 cột (chỉ link tới route có thật, không địa chỉ/SĐT bịa — chỉ dùng đúng hotline/email thật ở trên). Không làm các khối giảng viên/đối tác/đánh giá như IOT vì chưa có dữ liệu thật. Khối "3 bước" cũ (hứa "placement test 20 phút"/"AI study plan" không tồn tại) đã bỏ. Nhúng `<JsonLd />` ([frontend/src/components/seo/JsonLd.tsx](frontend/src/components/seo/JsonLd.tsx), chỉ name/url/logo/description — không rating/review).

**Chuyển động (motion)**: hero vào trang bằng CSS thuần (class `lp-enter`/`lp-enter-zoom`/`lp-pop-float`/`lp-underline`/`lp-blob`/`lp-shine`, độ trễ so le qua helper `d(ms)` → biến CSS `--d`); các mục bên dưới hiện dần khi cuộn qua thuộc tính `data-reveal` (`""`/`"zoom"`/`"left"`/`"right"`) + client component [ScrollReveal](frontend/src/components/landing/ScrollReveal.tsx) (IntersectionObserver). CSS ở khối "Landing motion" cuối `globals.css`, toàn bộ nằm trong `@media (prefers-reduced-motion: no-preference)`. Phần tử chỉ bị ẩn khi `<html>` có class `lp-motion` (do ScrollReveal thêm sau khi JS chạy) → không JS/bot vẫn thấy đủ nội dung. **Đặt `data-reveal` lên lớp bọc ngoài card, không đặt thẳng lên `ui-card-hover`** — transition-delay của reveal sẽ làm chậm hiệu ứng hover của card. Không thêm thư viện animation (framer-motion...).

**Video giới thiệu** (mục "Xem Lucy Tutor hoạt động" ngay dưới hero): `frontend/public/videos/lucy-tutor-features.mp4` (1776×840, ~73s, H.264, không tiếng, moov ở đầu file nên phát được ngay khi đang tải) + poster `lucy-tutor-features-poster.webp`, phát bằng [FeatureVideo](frontend/src/components/landing/FeatureVideo.tsx): `muted playsInline preload="none"`, phát nhanh **2×** (`PLAYBACK_RATE`) và bỏ 0,5s mở đầu gần như trắng (`START_AT`, poster là đúng khung hình tại mốc này; tự lặp bằng `onEnded` thay cho thuộc tính `loop` để mỗi vòng cũng bỏ đoạn trắng), bắt đầu tải khi còn cách ~800px để cuộn tới là phát ngay, tự phát khi ≥25% khung hình lọt vào màn hình (IntersectionObserver), cuộn qua thì dừng, có nút Tạm dừng/Phát (người dùng đã dừng thì không tự phát lại), bật "giảm chuyển động" thì không tự phát. Dùng MP4 chứ không dùng GIF: bản GIF cùng nội dung chỉ 900×426, 256 màu, nặng hơn (5,1MB) và không dừng được.

---

### `/auth` — Đăng nhập / Đăng ký

**File:** [frontend/src/app/auth/page.tsx](frontend/src/app/auth/page.tsx)

- Query param `?role=STUDENT|TEACHER` chọn vai trò mặc định
- Form toggle giữa **đăng nhập** và **đăng ký**
- **Không cho giáo viên tự đăng ký**: chế độ đăng ký chỉ dành cho Học Viên (ẩn toggle vai trò, luôn gửi `role: 'STUDENT'`); khi chọn "Giáo Viên" ở chế độ đăng nhập, link "Đăng ký ngay" được thay bằng dòng "Tài khoản Giáo Viên do quản trị viên cấp". Backend `POST /api/auth/signup` cũng trả `403` nếu `role` khác `STUDENT`. Trang chủ đã bỏ nút "Giáo viên đăng ký"; nút "Tôi là Giáo Viên" chỉ còn dẫn tới màn đăng nhập
- "Nhớ tôi" lưu `userId` vào `localStorage` (mặc định bật), ngược lại dùng `sessionStorage`
- Sau đăng nhập: TEACHER → `/teacher`, STUDENT → `/dashboard` — điều hướng dựa theo `role` **thật sự trả về từ server** (`data.role`), không phải toggle vai trò người dùng tự chọn trên UI
- **⚠️ QUAN TRỌNG — 3 loại tài khoản tách biệt hoàn toàn: Học viên (`STUDENT`), Giáo viên (`TEACHER`), Quản trị (`ADMIN`).** Tài khoản nào chỉ vào đúng khu vực của nó, không bao giờ dùng 1 tài khoản để vào khu vực của role khác: STUDENT → `/dashboard`, TEACHER → `/teacher`, ADMIN → chỉ `/administrator` (đăng nhập riêng, xem mục `/administrator`). `POST /api/auth/signin` luôn trả `403` với tài khoản ADMIN (bất kể chọn role gì); `/api/admin/login` chỉ nhận role ADMIN. Mọi trang kiểm tra role sau khi `/me` đều dùng `redirectToOwnArea(role, router)` / `homeForRole(role)` ở [frontend/src/lib/session.ts](frontend/src/lib/session.ts) — role không thuộc luồng userId (ADMIN) bị xoá phiên + về `/auth`. Khi thêm trang/route mới theo role: kiểm tra đúng role cần (`role === 'X'`), không dùng kiểu nhị phân `role !== 'TEACHER'` = học viên. Không có API/giao diện nào đổi role của tài khoản đã có
- **1 tài khoản bị khoá cứng vào 1 role**: `POST /api/auth/signin` gửi kèm `role` đang chọn trên toggle; backend so khớp với `role` đã lưu trong DB, trả về `403` nếu chọn sai vai trò (vd tài khoản học sinh chọn nhầm "Giáo Viên") — tránh việc 1 email đăng nhập lẫn lộn được cả 2 dashboard. Muốn có cả 2 vai trò phải tạo 2 tài khoản (2 email) riêng, `signup` đã chặn trùng email qua `@unique`
- **Đăng ký học viên tự do**: form đăng ký (không phải đăng nhập) có thêm ô "Mã Lớp Học — Tuỳ chọn". Nếu bỏ trống, hiện thêm dropdown bắt buộc **"Chọn Giáo Viên Phụ Trách"** (nạp từ `GET /api/auth/teachers`) — học viên không nhập mã lớp bắt buộc phải chọn 1 giáo viên phụ trách để kích hoạt cơ chế dùng thử/học phí theo tháng (xem mục "Học viên tự do" bên dưới). Nếu có nhập mã lớp, `signup` tự nối `classroomsJoined` luôn, bỏ qua bước chọn giáo viên.
- **Mật khẩu được hash bằng bcryptjs** (`BCRYPT_ROUNDS = 10` trong `auth.routes.js`) — `signup` hash trước khi lưu, `signin` so sánh bằng `bcrypt.compare`. Các tài khoản tạo trước khi có tính năng này đã được migrate 1 lần bằng script `backend/scripts/hashExistingPasswords.js` (idempotent — bỏ qua các hash đã bắt đầu bằng `$2`, an toàn chạy lại). `PUT /api/auth/change-password` cho phép đổi mật khẩu (yêu cầu đúng mật khẩu hiện tại).

---

## Học viên tự do — Dùng thử & học phí theo tháng

Áp dụng riêng cho học viên **không tham gia lớp nào** (`classroomsJoined.length === 0`) đăng ký **từ 01/08/2026 trở đi** — tài khoản tạo trước mốc này được miễn trừ hoàn toàn (không bị khoá).

- **Chọn giáo viên phụ trách lúc đăng ký** (xem mục `/auth` phía trên) — lưu vào `User.managerTeacherId` (self-relation trên `User`).
- **Dùng thử 3 ngày**: `User.accessExpiresAt` = `createdAt + 3 ngày` nếu đăng ký sau mốc cutoff (hằng số `FREE_TRIAL_CUTOFF`/`TRIAL_DAYS` trong [backend/src/utils/freeTrial.js](backend/src/utils/freeTrial.js)). Hàm `computeAccessStatus(user)` trong file này tính `accessLocked`/`accessDaysRemaining` — được gọi ở `GET /api/auth/me` và gắn thẳng vào response user (`{...user, accessLocked, accessDaysRemaining}`), không cần FE tự tính ngày.
- **Tham gia lớp bất kỳ lúc nào sẽ hủy hẳn cơ chế khoá**: `POST /api/classroom/join` set `accessExpiresAt: null` — từ đó việc thu học phí chuyển hẳn sang hệ thống Điểm Danh & Học Phí theo lớp (mục `/teacher` > ATTENDANCE), không còn áp dụng trial/khoá tháng nữa.
- **Hết hạn (dùng thử hoặc chưa đóng tiếp) → khoá toàn bộ app**: `dashboard/page.tsx` kiểm tra `user.accessLocked` ngay sau khi tải xong (trước cả `return` chính) — hiện màn hình khoá toàn màn hình (🔒, không có nav/sidebar), chỉ hiển thị thông tin liên hệ giáo viên phụ trách (`user.managerTeacher`: tên/SĐT/email) và nút Đăng Xuất. Không điều hướng đi đâu — việc kích hoạt lại hoàn toàn do giáo viên bấm tay.
- **Banner nhắc hạn 7 ngày**: hiện ở đầu mọi tab (không riêng OVERVIEW) khi `accessDaysRemaining <= 7` và chưa khoá, kèm tên/SĐT giáo viên phụ trách.
- **Giáo viên kích hoạt lại**: tab mới **HỌC VIÊN TỰ DO** ở `/teacher` (nhóm "Quản Lý Chung") — danh sách học viên tự do do mình phụ trách (`GET /api/free-students/teacher/:teacherId`, tự động loại học viên đã tham gia lớp), trạng thái Đang dùng thử/Đang hoạt động/Đã khóa. Nút "Xác Nhận Đóng Phí" mở SweetAlert2 nhập số tiền (giáo viên tự nhập, không có mức phí cố định) → `POST /api/free-students/confirm-payment` — gia hạn `accessExpiresAt` thêm đúng **1 tháng kể từ lúc xác nhận** (không phải từ ngày hết hạn cũ), đồng thời lưu 1 dòng lịch sử vào model `FreeStudentPayment`.
- **Học viên tự xem lại tình trạng tài khoản**: tab Cài Đặt (`/dashboard` > SETTINGS) có card "Tình Trạng Tài Khoản" (chỉ hiện nếu có `managerTeacher`) — trạng thái, số ngày còn lại, thông tin liên hệ giáo viên, và lịch sử thanh toán (`GET /api/free-students/payments/:studentId`).
- **Backend:** [backend/src/routes/freeStudent.routes.js](backend/src/routes/freeStudent.routes.js) (mount tại `/api/free-students`). Model `FreeStudentPayment` (Prisma) lưu `userId`, `teacherId` (ai xác nhận), `amount`, `paidAt`, `periodEnd`.

---

### `/dashboard` — Dashboard Học sinh

**File:** [frontend/src/app/dashboard/page.tsx](frontend/src/app/dashboard/page.tsx)

Tabs chính:
- **OVERVIEW** — Tổng quan: XP, streak, cấp bậc, biểu đồ điểm (LineChart), tiến độ mục tiêu
  - **Lưới "Luyện tập"** chia theo nhóm `PRACTICE_GROUPS` (4 Kỹ Năng / Luyện Thi / Từ Vựng & Ngữ Pháp / Phát Âm, cuối `dashboard/page.tsx`) + hàng chip lọc (`practiceFilter`, "Tất cả" hiện mọi nhóm kèm tiêu đề). Card **IELTS Cambridge** được làm nổi bật riêng bằng viền vàng gold `#d4af37` + badge "Nổi bật" (ngoại lệ có chủ đích với bảng màu navy)
  - **💡 Nhận Định & Gợi Ý Học Tập** — panel `InsightCard` (định nghĩa riêng trong `dashboard/page.tsx`, cùng pattern với `businessInsights` bên `teacher/page.tsx` nhưng độc lập) tự động sinh nhận định cá nhân hoá (rule-based, không gọi AI) từ: tiến độ so với mục tiêu điểm, xu hướng điểm 3 bài gần nhất so với 3 bài trước, kỹ năng yếu nhất trong 4 kỹ năng (`/api/skill-progress/:userId`), chuyên đề sai nhiều nhất trong Sổ Tay Lỗi Sai, streak học tập, số bài đang chờ xử lý. Biến `studentInsights`, tối đa 6 thẻ, sắp theo mức độ nghiêm trọng. Mỗi insight có thể kèm `cta?: { label, tab? , href? }` — hiện nút bấm dẫn thẳng tới hành động gợi ý (vd "Xem Sổ Tay Lỗi Sai" chuyển tab `NOTEBOOK`, "Luyện Reading Ngay" điều hướng `/reading`) thay vì chỉ hiển thị chữ suông
  - **Tự động làm mới (near real-time)**: khi đang ở tab OVERVIEW, hồ sơ người dùng (`/api/auth/me`), lịch sử làm bài (`/api/analytics/history`) và tiến độ kỹ năng được refetch mỗi 30 giây (`setInterval`) và ngay khi tab trình duyệt lấy lại focus (`visibilitychange`) — cùng cơ chế polling phía client như tab OVERVIEW của giáo viên, không dùng WebSocket
- **EXAMS** — Danh sách đề thi được giao, nút làm bài
- **LESSONS** — Bài học từ lớp đã tham gia. Nếu học sinh tham gia từ 2 lớp trở lên, hiện dropdown lọc theo lớp (`lessonClassFilter`)
- **MISTAKES** — Sổ tay lỗi sai
- **LEADERBOARD** — Bảng xếp hạng lớp
- **CALENDAR** — Lịch học (FullCalendar) — trên điện thoại (<768px) tự chuyển sang view theo ngày (`timeGridDay`) + toolbar rút gọn thay vì view tuần 7 cột mặc định (xem `CalendarComponent`)
- **SETTINGS** (Cài Đặt Tài Khoản) — bố cục 2 cột (`grid lg:grid-cols-2`, cột đơn trên mobile): **cột trái** = Thông Tin Cá Nhân (SĐT, mục tiêu điểm số) + Đổi Mật Khẩu (`PUT /api/auth/change-password`); **cột phải** = Tình Trạng Tài Khoản (chỉ hiện với học viên tự do, xem mục "Học viên tự do" phía trên) + Lớp Học Của Tôi (danh sách lớp đã tham gia kèm lịch học) + Tham Gia Lớp Học (mã join code) + Đăng Xuất

Tính năng nổi bật:
- Upload avatar (base64) — ảnh được resize + nén JPEG (tối đa 256px, q=0.85) **client-side qua Canvas** trước khi lưu (xem `compressImageToBase64` trong phần Lưu ý kỹ thuật); giới hạn 100MB chỉ áp dụng cho file gốc trước khi nén
- Tham gia lớp bằng mã join code
- Hiển thị confetti khi đạt mốc XP
- Nút **"Cài Đặt Ứng Dụng"** (`InstallPWAButton`) ở header — cài app lên điện thoại qua PWA (`beforeinstallprompt` trên Android/Desktop, hướng dẫn thủ công cho iOS Safari)
- **Màn hình khoá cho học viên tự do hết hạn** + **banner nhắc hạn 7 ngày** — xem chi tiết ở mục "Học viên tự do — Dùng thử & học phí theo tháng" phía trên

---

### `/teacher` — Dashboard Giáo viên

**File:** [frontend/src/app/teacher/page.tsx](frontend/src/app/teacher/page.tsx)

Tabs chính (điều hướng theo nhóm — xem `navGroups` trong file):
- **OVERVIEW** (Tổng Quan) — Dashboard "sức khỏe kinh doanh" của giáo viên, thiết kế theo chuẩn BI dashboard (KPI → insights → biểu đồ chi tiết):
  - 6 thẻ KPI đầu trang (`StatCard` với icon + màu nền theo `accent`): Tổng Học Viên, Tổng Lớp Đang Dạy, **Doanh Thu Tháng Này** (kèm badge tăng/giảm % so với tháng trước, `revenueMoMPct`), Tỷ Lệ Thu Học Phí (tháng hiện tại), Tỷ Lệ Nộp Bài, Điểm TB Học Viên (trung bình `classroomScoreStats`)
    - **Doanh Thu Tháng Này = học phí theo lớp + doanh thu học viên tự do** (`revenueThisMonthTotal = DaThu + HocVienTuDo`) — trước đây chỉ tính học phí theo lớp nên giáo viên có nhiều học viên tự do (xem mục "Học viên tự do" phía dưới) sẽ thấy con số thấp hơn thực tế. `GET /api/attendance/report/teacher/:teacherId` trả thêm field `freeStudentRevenue` (tổng `FreeStudentPayment.amount` có `paidAt` rơi vào tháng/năm truy vấn), cộng riêng ở **frontend** vào KPI + biểu đồ 6 tháng. **Không** cộng vào `totalCollected`/`totalExpected` gốc — 2 field này vẫn giữ nguyên nghĩa "chỉ học phí theo lớp" vì được dùng để tính Tỷ Lệ Thu Học Phí, biểu đồ donut "Tình Hình Thu Học Phí" và bảng Đã Đóng/Chưa Đóng (những chỗ này không có khái niệm "cần thu" rõ ràng cho học viên tự do nên không gộp vào được)
  - **💡 Insights & Khuyến Nghị Kinh Doanh** — panel `InsightCard` tự động sinh nhận định (rule-based, không gọi AI) từ dữ liệu đang có trên dashboard: tăng/giảm doanh thu theo tháng, tốc độ thu học phí, tỷ lệ nộp bài, lớp có điểm TB thấp/cao nhất, lớp có tỷ lệ chưa đóng học phí cao, lớp sĩ số quá nhỏ (cơ hội tuyển sinh), học viên học dưới mục tiêu điểm số, **học viên tự do đã bị khóa/sắp hết hạn trong 7 ngày** (dựa vào `accessLocked`/`accessDaysRemaining` từ `GET /api/free-students/teacher/:teacherId`, fetch cả khi đang ở tab OVERVIEW chứ không chỉ tab FREE_STUDENTS). Mỗi insight có `level` (critical/warning/success/info) quyết định màu và được sắp xếp mức độ nghiêm trọng giảm dần, tối đa 6 thẻ. Logic nằm ngay trong `TeacherDashboard` (biến `businessInsights`), không có API riêng
  - **Tự động làm mới (near real-time)**: trong lúc đang ở tab OVERVIEW, `overviewRefreshTick` tăng mỗi 30 giây (`setInterval`) và mỗi khi tab trình duyệt lấy lại focus (`visibilitychange`), kéo theo refetch `classrooms` + báo cáo học phí + doanh thu 6 tháng + danh sách học viên tự do → toàn bộ KPI/insight tính lại theo dữ liệu mới nhất mà không cần bấm F5. Không dùng WebSocket/push — đây là polling phía client, giữ đúng kiến trúc REST hiện có của dự án
  - **Doanh Thu Học Phí 6 Tháng Gần Đây** (BarChart) — gọi `GET /api/attendance/report/teacher/:teacherId` 6 lần (mỗi tháng 1 lần, `Promise.all`) để dựng biểu đồ Cần Thu/Đã Thu theo lớp + cột riêng Học Viên Tự Do theo tháng, không cần API mới
  - **Sĩ Số & Bài Tập Theo Lớp** (BarChart nhóm cột) — so sánh số học sinh và số bài tập giữa các lớp
  - **Tình Hình Thu Học Phí** (PieChart dạng donut) — Đã thu / Còn thiếu của tháng hiện tại (`overviewTuitionMonth`), có nhãn % ở giữa vòng tròn
  - **Điểm Trung Bình Theo Lớp** (BarChart ngang, xếp hạng) — điểm trung bình cao nhất mỗi đề của học sinh, tính bằng `studentAvgScore`/`classroomScoreStats`
  - Không hiển thị lưới danh sách lớp học ở đây nữa (đã chuyển hẳn sang tab **CLASSES**, tránh trùng lặp)
  - Bên dưới vẫn còn **Quản Lý Thu Học Phí** (bảng chi tiết theo tháng, lọc "Tất cả" / "Chỉ chưa đóng")
- **CLASSES** (Lớp Học) — Quản lý lớp học (tạo/sửa/xóa), xem danh sách học sinh. Nút xóa lớp (`ClassCard` → `onDelete`) hiện khi hover, xác nhận qua SweetAlert2; xóa cascade toàn bộ bài học/đề thi/tài liệu/điểm danh/học phí của lớp đó
  - **Cách tính học phí chọn lúc tạo/sửa lớp** (`Classroom.feeType`, "PER_LESSON" mặc định hoặc "MONTHLY"), 2 chế độ chạy song song, không đổi lẫn nhau giữa các lớp: **Theo Buổi** (`feePerLesson` × số buổi PRESENT trong tháng — vắng không tính tiền, dùng cho lớp Giao Tiếp Cho Người Lớn) hoặc **Theo Tháng** (`feePerMonth` — **thu trọn gói cố định vào đầu tháng, không phụ thuộc số buổi PRESENT thực tế**; đã bỏ hẳn công thức quy đổi theo tỉ lệ buổi học cũ vì giáo viên thu học phí đầu tháng chứ không đợi đủ buổi mới thu). Backend gom logic vào 1 hàm dùng chung `calcTuitionAmount(classroom, presentCount, month, year)` trong [backend/src/routes/attendance.routes.js](backend/src/routes/attendance.routes.js), áp dụng cho cả 3 báo cáo (`/report/:classroomId`, `/report/teacher/:teacherId`, `/my-tuition/:userId`) — tránh lệch công thức giữa các endpoint. `TuitionInvoice` (hóa đơn PDF) và badge chế độ tính phí ở đầu bảng "Báo Cáo Học Phí" tự đổi nhãn/mô tả theo `feeType` của từng lớp
    - **Điểm danh với lớp MONTHLY giờ thuần là dữ liệu theo dõi chuyên cần, không ảnh hưởng học phí**: `getStandardLessonsInMonth(classroom, month, year)` (duyệt từng ngày trong tháng, đếm số ngày trùng `Classroom.scheduleDays` để ra số buổi chuẩn thật của đúng tháng đó) vẫn được gọi và trả về qua `classroom.standardLessons`, nhưng chỉ để hiển thị "X/Y buổi" mang tính tham khảo (badge chế độ tính phí, cột "Số Buổi Học" ở bảng Báo Cáo Học Phí, dòng mô tả trong `TuitionInvoice`) — **không** còn nhân/chia vào `totalAmount` như trước. Học viên nghỉ nhiều trong tháng vẫn đóng đủ `feePerMonth`, không tự động trừ/hoàn tiền (cần điều chỉnh thủ công nếu có trường hợp đặc biệt)
- **STUDENTS** (Học Sinh) — Danh sách toàn bộ học sinh, tìm kiếm theo tên/email, sắp xếp theo Tên/Điểm XP/Điểm TB/Tiến độ/Ngày đăng ký (mỗi tiêu chí 2 chiều tăng-giảm, dropdown `studentSortOption`, lọc rồi mới sort rồi mới đưa vào `usePagination` — đúng nguyên tắc phân trang chung của dự án), hiển thị cấp bậc/XP, điểm trung bình, tiến độ so với mục tiêu, ngày đăng ký
  - **Thêm Học Viên Thủ Công** — nút "+ Thêm Học Viên" mở modal nhập tên/email/SĐT (tùy chọn) + chọn 1 hoặc nhiều lớp học có sẵn (checkbox) để gán ngay lúc tạo. Gọi `POST /api/classroom/add-student` — backend tự hash mật khẩu mặc định **"123456"** (bcrypt, cùng `BCRYPT_ROUNDS` với `signup`) và tạo tài khoản `role: STUDENT` nối thẳng vào các lớp đã chọn; chỉ chấp nhận `classroomIds` thuộc đúng `teacherId` gọi API (chặn gán nhầm/gán ẩu vào lớp giáo viên khác), từ chối nếu email đã tồn tại. Dùng cho học viên đăng ký ngoài đời/qua điện thoại mà giáo viên nhập hộ, không cần học viên tự `signup`; học viên đăng nhập bằng email đó + mật khẩu mặc định rồi tự đổi qua `PUT /api/auth/change-password` sau. Danh sách học viên trong `classrooms` state được patch lạc quan ngay khi tạo xong (không chờ round-trip `fetchTeacherData()`) nên STUDENTS/CLASSES nhảy real-time
- **FREE_STUDENTS** (Học Viên Tự Do) — danh sách học viên tự do (0 lớp) đã chọn giáo viên này làm người phụ trách lúc đăng ký (`GET /api/free-students/teacher/:teacherId`, tự loại học viên đã tham gia lớp). Hiển thị trạng thái Đang dùng thử/Đang hoạt động/Đã khóa + ngày hết hạn. Nút "Xác Nhận Đóng Phí" (SweetAlert2 nhập số tiền tự do, không có mức phí cố định) → `POST /api/free-students/confirm-payment`, gia hạn quyền sử dụng thêm đúng 1 tháng kể từ lúc xác nhận. Xem chi tiết ở mục "Học viên tự do — Dùng thử & học phí theo tháng"
- **ATTENDANCE** (Điểm Danh & Học Phí) — 2 view con:
  - **Điểm Danh** — lưới điểm danh trực quan dạng bảng: hàng = toàn bộ học viên (mặc định **tất cả các lớp**, dropdown "Chọn Lớp Học" lọc về 1 lớp cụ thể, `attClassroomId` rỗng = tất cả), cột = **từng ngày trong tháng** đang chọn (`input type="month"`, state `attMonth`) kèm thứ trong tuần (dùng chung map `{0:'CN',1:'T2',...,6:'T7'}` với Calendar). Mỗi ô là nút tick: bấm để chuyển Có mặt (xanh) ↔ Vắng (đỏ), cập nhật lạc quan (optimistic) vào state `attMonthRecords` ngay khi bấm nên cột **"Tổng Buổi" cập nhật real-time**, không cần chờ phản hồi server (rollback + báo lỗi qua SweetAlert2 nếu lưu thất bại). Dữ liệu cả tháng nạp 1 lần qua `GET /api/attendance/month/teacher/:teacherId`, mỗi lần tick chỉ gửi 1 bản ghi tới `POST /api/attendance/mark` (không đổi API này). Cột tên học viên dùng `sticky` khi cuộn ngang; danh sách học viên phân trang bằng `usePagination`. Trạng thái điểm danh giờ chỉ còn nhị phân `PRESENT`/`UNEXCUSED` (bỏ hẳn 2 nút "Vắng có phép"/"Vắng không phép" cũ — trước đây 2 giá trị này ghi sai chuỗi `_ABSENCE` không khớp với backend nên chưa từng được báo cáo học phí tính đúng)
  - **Báo Cáo Học Phí** — theo từng lớp (bắt buộc chọn 1 lớp cụ thể), xuất hóa đơn PDF/Excel. Nút "Xác nhận đã nộp" cập nhật badge/trạng thái **real-time** bằng cách patch thẳng vào state `attReport` ngay khi API `POST /api/attendance/pay` trả về thành công, không đợi refetch toàn bộ báo cáo
  - `POST /api/attendance/mark` nhận cả mảng bản ghi (1 hoặc nhiều học viên) nhưng **bỏ qua các bản ghi không có `status`** khi lưu — tránh việc 1 học viên chưa được gửi trạng thái làm hỏng lưu của cả batch (do cột `status` là bắt buộc)
- **CHEAT_CONTROL** (Kiểm Soát Gian Lận) — xem log gian lận (mất focus tab, copy/paste) theo học sinh/đề thi
- **CALENDAR** (Thời Khóa Biểu) — Lịch lên lớp (FullCalendar)
- **LESSONS** (Danh Sách Bài Học) — danh sách bài học đã tạo, dropdown lọc theo lớp (`lessonClassFilter`)
- **CREATE_LESSON** (Tạo Bài Học) — soạn bài học (ReactQuill), nhập từ vựng hàng loạt qua Excel mẫu
- **DOCUMENTS** (Kho Tài Liệu) — Tài liệu đính kèm. Hỗ trợ định dạng PDF, Word (.doc/.docx) và **PowerPoint (.ppt/.pptx)**
- **LISTENING_STUDIO** (Studio Luyện Nghe) — giáo viên upload audio (.mp3/.m4a/.wav) đã tạo sẵn bằng AI TTS bên ngoài + script chính xác 100% (không gọi TTS trong app). Form: tiêu đề, script, file audio, **giọng đọc** (UK/US/AUS), **cấp độ CEFR (A1-C1, bắt buộc chọn)** — dùng chung `CEFR_LEVELS` với 4 trang luyện kỹ năng, **phạm vi gán** (1 lớp học hoặc 1 học sinh cụ thể — bắt buộc chọn đúng 1 trong 2). Danh sách audio hiện trạng thái Đang xử lý/Sẵn sàng/Lỗi (`ListeningClip.status`) và badge cấp độ (`ListeningClip.level`)
- **EXAMS** (Ngân Hàng Đề Thi) — danh sách đề thi/bài tập đã tạo (`ExamCard`), nhân bản/sửa/xóa
- **CREATE** (Tạo Đề Mới) — soạn đề thi thủ công:
  - Mỗi câu hỏi là 1 card dạng **accordion** (thu gọn/mở rộng từng câu hoặc "Thu Gọn Tất Cả"/"Mở Rộng Tất Cả"), có thanh tiến trình "Đã soạn xong X/Y câu"
  - **Nhập nhanh từ Excel**: nút "Tải Excel Mẫu" (cột Loại TN/TL, Câu hỏi, 4 đáp án, đáp án đúng, giải thích, điểm) và "Nhập Từ Excel" — đổ thẳng câu hỏi vào form để rà soát trước khi lưu, không cần nhập tay từng câu
- **LEADERBOARD** (Bảng Xếp Hạng)

Tính năng nổi bật:
- Rich text editor (ReactQuill) soạn câu hỏi với toolbar bold/italic/color
- Xuất báo cáo Excel (xlsx-js-style) và PDF (jsPDF)
- Xuất hóa đơn học phí qua component `TuitionInvoice`
- Mobile: hamburger menu (`isMobileMenuOpen`); header và card của các danh sách (LESSONS, EXAMS) tự xếp dọc (`flex-col sm:flex-row`) trên màn hình hẹp thay vì ép chung 1 hàng

---

### `/exam/[id]` — Làm bài thi thật

**File:** [frontend/src/app/exam/[id]/page.tsx](frontend/src/app/exam/[id]/page.tsx)

- Load đề thi theo `id` từ API
- Giao diện làm bài trắc nghiệm + tự luận (essay)
- Theo dõi gian lận: mất focus tab, copy/paste, chụp màn hình → gửi lên `POST /api/exams/cheat`
- Nộp bài → `POST /api/exams/:id/submit` với `userId` từ storage
- Sau nộp: hiển thị kết quả, điểm, giải thích từng câu
- **Highlight đề bài + Ghi chú theo từng highlight lúc làm bài** — thuần client-side, không tính điểm, không ảnh hưởng chấm bài, không lưu server (mất khi rời trang, đúng tinh thần "giấy nháp"):
  - **Kích hoạt bằng chuột phải/ấn giữ, không phải mouseup**: bôi đen văn bản trong khối đề bài (`question.heading` + `question.content`, cả 2 đều là HTML từ ReactQuill) rồi **bấm chuột phải** (desktop, `onContextMenu`) hoặc **ấn giữ ~450ms không di chuyển** (điện thoại — tự đo bằng `onTouchStart`/`onTouchEnd` vì sự kiện `contextmenu` không đáng tin cậy trên mọi trình duyệt di động, đặc biệt Safari iOS) mới hiện menu nổi, thay vì tự bật ngay sau khi bôi đen như trước. Menu gồm 5 chấm màu (Vàng/Xanh Lá/Xanh Dương/Hồng/Cam, nhớ màu dùng gần nhất qua `localStorage` key `examHighlightColor`) + nút "📝 Ghi chú". Bấm chuột phải/ấn giữ lại đúng vào 1 highlight có sẵn mở lại menu này (kèm thêm nút 🗑 xoá) để đổi màu hoặc sửa ghi chú.
  - **Highlight**: do nội dung là HTML chứ không phải text thuần, không dùng `Range.surroundContents()` trên cả range (sẽ throw ngay khi selection cắt qua nhiều thẻ) — thay vào đó đi qua từng text node giao với Range (`document.createTreeWalker` + `range.intersectsNode`) và bọc `<mark class="exam-user-highlight">` riêng cho từng đoạn. Mọi fragment `<mark>` sinh ra từ cùng 1 lần bôi đen dùng chung `data-hl-id` (không phải chỉ 1 id/mark) để đổi màu/ghi chú/xoá tác động đúng lên toàn bộ highlight logic đó thay vì chỉ đúng fragment DOM đang trỏ tới. Bấm (click trái, không phải chuột phải) vào chỗ đã highlight để bỏ nguyên highlight đó (và ghi chú đi kèm, nếu có). Vùng đề bài được gắn `select-text` để ghi đè `select-none` ở root (root vẫn `select-none` khi đang làm bài thật — chỉ mở lại đúng vùng cần bôi đen, không ảnh hưởng phần đáp án/điều hướng)
  - **Ghi chú gắn theo highlight, không theo câu**: bấm "📝 Ghi chú" trong menu (tự tạo highlight bằng màu đang chọn trước nếu chưa có) mở 1 ô nhỏ (`noteEditor`, textarea + Lưu/Huỷ) neo cạnh vị trí bấm — không còn là khung ghi chú cố định cho cả câu như trước. Nội dung lưu trong state `highlightNotes` (key = `hlId`), thuần trong React state (không `localStorage`) vì bản thân highlight cũng không được lưu lại qua reload — gắn `localStorage` cho ghi chú khi highlight đã ephemeral sẽ chỉ tạo dữ liệu mồ côi. Highlight có ghi chú được viền gạch chấm bên dưới + `title` hiện preview khi hover.
  - Không xung đột với chống gian lận copy/paste đang có — thao tác bôi đen/chuột phải/ghi chú không kích hoạt sự kiện `copy`, chỉ có Ctrl+C/X/V thật mới bị chặn và log gian lận như cũ. Chuột phải trong vùng đề bài chỉ mở menu tuỳ chỉnh này (không log gian lận, giống hành vi chặn context-menu mặc định từ trước — chỉ đổi UI hiện ra), chuột phải ở nơi khác trên trang vẫn bị chặn như cũ.

### `/exam` — Demo làm bài (mock)

**File:** [frontend/src/app/exam/page.tsx](frontend/src/app/exam/page.tsx)

Trang demo với 1 câu hỏi mẫu. Hai chế độ: **Practice** (feedback ngay) và **Exam** (nộp xong mới feedback). Khi sai hiển thị `AskAIButton`.

---

### `/grammar-gym` và `/gym` — Luyện tập ngữ pháp & từ vựng (SRS)

**Files:** [frontend/src/app/grammar-gym/page.tsx](frontend/src/app/grammar-gym/page.tsx), [frontend/src/app/gym/page.tsx](frontend/src/app/gym/page.tsx)

Module luyện tập ngữ pháp theo chuyên đề, tích hợp SRS (Spaced Repetition System).

**`/gym` (Phòng Gym Từ Vựng)** — flashcard ôn từ vựng theo thuật toán SM-2 (`calculateSM2` trong [backend/src/routes/srs.routes.js](backend/src/routes/srs.routes.js)), field `status`/`repetitions`/`interval`/`easeFactor` lưu ở `UserVocabProgress`. Tab **Ôn Tập** có 2 chế độ, tự động chọn theo từng thẻ (không cho học sinh tự chuyển):

- **Lật thẻ (mặc định, từ mới/`status === 'LEARNING'` hoặc `repetitions < 2`):** hiện nghĩa → bấm lật để xem từ/phiên âm/ví dụ → tự chấm điểm bằng 4 nút Lại/Khó/Tốt/Dễ (quality 1/3/4/5)
- **Gõ đáp án (`status !== 'LEARNING' && repetitions >= 2`):** hiện nghĩa tiếng Việt, học sinh gõ từ tiếng Anh, có nút "💡 Gợi Ý" (hiện chữ cái đầu + số ký tự còn lại dạng `a _ _ _ _`). Tự động chấm và suy ra `quality` để gọi lại đúng `POST /api/srs/review/:progressId` (không có API/schema riêng):
  - Đúng tuyệt đối, không xin gợi ý → quality 5
  - Đúng tuyệt đối, có xin gợi ý → quality 4
  - Gõ gần đúng (Levenshtein ≤ 2 sau khi chuẩn hoá bằng `cleanString` — cùng cách chuẩn hoá với `grammar-gym`) → quality 3
  - Sai hẳn hoặc bỏ trống → quality 1

  Điều kiện kết hợp `status` + `repetitions` (thay vì chỉ `status`) để tránh việc một từ vừa đúng lần đầu (đã nhảy sang `REVIEWING` ngay do SM-2) đã bị ép gõ ngay khi chưa kịp quen mặt chữ.

- **Thanh tiến độ khi ôn tập**: `sessionTotal` chốt lại tổng số thẻ ngay khi vào tab Ôn Tập, thanh tiến độ tính `% = (sessionTotal - dueVocabs.length) / sessionTotal` (thẻ trả lời sai bị đẩy xuống cuối hàng đợi để ôn lại nên không tính là đã hoàn thành). Dòng chữ hiển thị "Thẻ X/Y · Còn lại N thẻ" để học sinh biết cả vị trí hiện tại lẫn số thẻ còn lại.
- **Tab "Từ Của Tôi" — tự thêm từ vựng**: trước đây `VocabItem` chỉ được tạo như con của 1 `Lesson` do giáo viên soạn (`lessonId` bắt buộc) → học viên tự do (0 lớp) **không có cách nào đưa từ vào deck SRS của mình**, khiến cả `/gym` lẫn `/listening` là ngõ cụt với nhóm này. Đã sửa: `VocabItem.lessonId` giờ **nullable**, thêm `addedByUserId` (self-added, không gắn `Lesson` nào) — học viên bấm "+ Thêm Từ Mới" (từ, nghĩa, phiên âm/ví dụ tuỳ chọn) gọi `POST /api/srs/vocab/custom`, tạo `VocabItem` + `UserVocabProgress` cùng lúc, từ mới vào hàng đợi ôn tập ngay. `GET/DELETE /api/srs/vocab/custom/:id` (chỉ xoá được từ tự thêm, không xoá được từ giáo viên giao). Tính năng mở cho **mọi học viên**, không riêng học viên tự do.

---

### `/pronunciation` — Luyện Phát Âm Cùng AI

**File:** [frontend/src/app/pronunciation/page.tsx](frontend/src/app/pronunciation/page.tsx)

Công cụ tự luyện mới, không thuộc 4 kỹ năng chính — nội dung luyện tập lấy hoàn toàn từ **deck từ vựng SRS của chính học viên** (`GET /api/pronunciation/practice-set/:userId`, cùng pattern không-gate-theo-due-date với `/listening`), không cần giáo viên soạn riêng — nhờ vậy học viên tự do (dùng tính năng tự thêm từ ở `/gym`) cũng luyện được ngay.

- **Nghe mẫu**: `window.speechSynthesis` phía trình duyệt (như `/phonetics`), không gọi API nào.
- **Ghi âm thật**: `MediaRecorder`/`getUserMedia` — hạ tầng ghi âm đầu tiên trong codebase (khác `/conversation` vốn dùng Web Speech API chuyển giọng nói → text ngay trên trình duyệt, không gửi audio lên server).
- **Chuyển giọng nói thành văn bản**: `POST /api/pronunciation/transcribe` gọi Groq Whisper (`whisper-large-v3`) **đồng bộ** (khác `/listening` xử lý ngầm fire-and-forget) — buffer ghi âm gửi thẳng qua `toFile()` của `groq-sdk`, không lưu Supabase Storage (clip ngắn, dùng 1 lần).
- **Chấm điểm**: so khớp từng từ theo vị trí giữa transcript và câu/từ mẫu (`matchScore` = tỉ lệ khớp × 10) — là ước lượng dựa trên nhận dạng giọng nói tự động, **không phải chấm âm vị học chính xác**, UI diễn đạt đúng mức độ này.
- **Góp ý AI**: `POST /api/pronunciation/coach` — đưa từ bị lệch cho Groq LLM đoán lỗi phát âm thường gặp của người Việt (âm cuối, trọng âm, nguyên âm dài/ngắn...) và gợi ý sửa.
- **Lịch sử**: model `PronunciationAttempt`, xuất PDF qua `SkillReportPDF` (tái dùng, không viết component mới).
- Điểm `matchScore` được log vào biểu đồ 4 kỹ năng dưới `SPEAKING` (`source: "PRONUNCIATION_PRACTICE"`) — coi phát âm là 1 phần của kỹ năng Speaking, không cần thêm kỹ năng thứ 5 vào allowlist backend.

---

### `/mock-test` — Đề Thi Thử THPT Quốc Gia

**File:** [frontend/src/app/mock-test/page.tsx](frontend/src/app/mock-test/page.tsx)

Công cụ tự luyện mới — AI tự sinh 1 đề trắc nghiệm đúng cấu trúc đề Tiếng Anh THPT Quốc Gia thật, làm trong 1 phiên có tính giờ, không phải bài giáo viên giao (khác hẳn hệ thống `Exam`/`Question` ở `/teacher` > EXAMS — 2 hệ thống grading hoàn toàn tách biệt, không dùng chung code).

- **2 độ dài**: Đề Ngắn (~20 câu/25 phút) và Đề Đầy Đủ (~40 câu/50 phút), chia 5 phần: Ngữ Âm, Ngữ Pháp & Từ Vựng, Giao Tiếp, Đọc Điền Từ, Đọc Hiểu.
- **Sinh đề**: `POST /api/mock-test/generate` gọi Groq **2 lần song song** — 1 lần cho 3 phần rời rạc (không cần đoạn văn), 1 lần cho 2 phần cần đoạn văn (Đọc Điền Từ + Đọc Hiểu) — tránh 1 JSON phản hồi quá dài dễ bị cắt/parse lỗi. Mọi câu hỏi dùng chung khuôn `ReadingQuestion` (từ `readingGrading.ts`) gắn thêm field `section`, nên tái dùng nguyên `isReadingAnswerCorrect`/`readingCorrectAnswerLabel` để chấm — không viết logic chấm mới.
- **Đếm giờ**: sticky khi đang làm bài (`stage === "TAKING"`), tự nộp bài khi hết giờ — **không** có chống gian lận (tab-focus/copy-paste) như `/exam/[id]`, vì đây là công cụ tự luyện cá nhân không giáo viên theo dõi kết quả.
- **Phân tích AI sau khi nộp**: `POST /api/mock-test/analysis` — nhận xét + chiến thuật ôn tập theo từng phần (`section`), giống hệt pattern `reading-analysis`.
- **Lịch sử**: model `MockTestAttempt`, xuất PDF qua `SkillReportPDF`. **Không** ghi vào biểu đồ 4 kỹ năng (đề trộn ngữ pháp/từ vựng/đọc, không map sạch vào 1 trong 4 kỹ năng) — giữ điểm số/lịch sử độc lập cho riêng công cụ này.
- **Backend:** [backend/src/routes/mockTest.routes.js](backend/src/routes/mockTest.routes.js).

---

## Module IELTS Cambridge — Trích xuất PDF/Audio + Chấm điểm theo Band

Giáo viên upload nguyên 1 file PDF cả cuốn sách Cambridge IELTS (bản số hoá, copy chữ được — không phải bản scan) kèm audio Listening, AI tự tách sách thành nhiều đề (Test 1, Test 2...) và trích xuất đủ 4 kỹ năng (Listening/Reading/Writing/Speaking) kèm đáp án Listening/Reading khớp theo Answer Key của sách, thành nội dung có thể sửa được rồi publish cho học viên tự luyện hoặc giao bài có hạn nộp. Khác hẳn `/mock-test` (AI tự sinh đề mới mỗi lần, không tái dùng): nội dung IELTS trích xuất được **lưu lại và tái sử dụng** — nhiều học viên cùng làm chung 1 đề đã trích xuất, nên dùng model Prisma riêng biệt (`IeltsBook`/`IeltsTest`/...) thay vì nhồi JSON theo từng lần làm bài như `MockTestAttempt`. Landing page (`frontend/src/app/page.tsx`) từng quảng cáo sẵn "chấm theo 4 tiêu chí IELTS" cho Writing/Speaking trước khi module này tồn tại — module này chính là chỗ hiện thực hoá đúng lời hứa đó.

**Trạng thái: đã hoàn thiện đủ 6 giai đoạn của kế hoạch** (schema → pipeline trích xuất 4 kỹ năng → chấm Listening/Reading tự động → chấm Writing/Speaking bằng AI → trang học sinh + lịch sử → xuất PDF báo cáo band). **Đã chạy `npx prisma db push` thành công (27/09/2026)** từ máy của user — các bảng `Ielts*` đã tồn tại trên DB. Ngoài ra, 2 chỗ số liệu cần tự tra lại nguồn chính thức IELTS trước khi tin tưởng hoàn toàn — xem 2 mục cuối phần "Chấm điểm" bên dưới — code đã có số liệu thật (không phải placeholder rỗng) nhưng lấy từ hiểu biết chung, chưa đối chiếu với 1 nguồn chính thức cụ thể.

### Phát hiện quan trọng: `pdf-parse@2.4.5` đổi API so với v1

`backend/src/utils/documentParser.js`'s `extractTextFromFile` từng gọi `pdfParse(buffer)` như 1 hàm (API v1) — bản đang cài (`v2.4.5`) export ra class `PDFParse`, không phải hàm gọi được, code cũ sẽ throw `TypeError` nếu chạy (chưa ai gặp vì route duy nhất gọi tới, `upload.routes.js`'s `/exam`, đã xác nhận không dùng ở đâu). Đã sửa lại theo API v2 thật và verify bằng 1 file PDF tự tạo (xác nhận tách đúng theo từng trang):
```js
const { PDFParse } = require('pdf-parse');
const parser = new PDFParse({ data: buffer });
const result = await parser.getText();
// result.text  -> toàn bộ text
// result.pages -> Array<{ num, text }> — tách sẵn theo trang, 1 lần gọi duy nhất
await parser.destroy();
```
Hàm mới `extractTextWithPages(buffer)` trả về `{ text, pages }`, dùng riêng cho pipeline IELTS (cần biết trang để định vị ranh giới Test/Section). `parseExamText`/`parseAnswerText`/`combineExamAndAnswers` (dùng riêng cho format "Câu X:" cũ) giữ nguyên, không liên quan.

### Pipeline trích xuất ([backend/src/utils/ieltsExtraction.js](backend/src/utils/ieltsExtraction.js))

3 pass, chạy nền (fire-and-forget, cùng pattern `setTimeout(..., 100)` của `listening.routes.js`'s `processAlignment`):

- **⚠️ Giới hạn token/phút của Groq**: gói miễn phí của `openai/gpt-oss-120b` chỉ cho **8.000 TPM**, và 1 request có input lớn hơn mức này bị từ chối ngay (lỗi `413 Request too large`) — từng xảy ra khi Pass 1 gửi nguyên cả cuốn sách (~64k token). Vì vậy mọi lệnh Groq trong pipeline đi qua `callJsonGroq` = **hàng đợi tuần tự** có theo dõi token đã dùng trong 60s gần nhất, tự chờ + thử lại khi gặp 429, từ chối sớm với thông báo tiếng Việt nếu 1 request vượt hạn mức, `reasoning_effort: 'low'` với model gpt-oss. Hạn mức cấu hình bằng biến môi trường `GROQ_TPM_LIMIT` (mặc định 8000) — nâng gói Groq thì tăng biến này trên Render. Hệ quả: trích xuất cả 1 cuốn (~30 lệnh) mất khoảng 20-30 phút ở gói miễn phí.
- **Pass 1 — tìm ranh giới cả sách** (`runBoundaryExtraction`): **không gọi AI** — đọc thẳng tiêu đề ở vài dòng đầu mỗi trang (`detectBoundariesByHeadings`: dòng "Test N", tiêu đề viết HOA đúng nguyên dòng `LISTENING`/`READING`/`WRITING`/`SPEAKING`, "Audioscripts", "Listening and Reading answer keys"). Chỉ khi kết quả không hợp lệ (mỗi đề phải có ≥2/4 kỹ năng) mới fallback AI, và AI cũng chỉ nhận vài dòng đầu mỗi trang, chia chunk vừa hạn mức TPM. Đã kiểm chứng đúng hoàn toàn trên Cambridge IELTS 21. Kết quả lưu vào `IeltsBook.boundariesJson`, cắt sẵn `answerKeyText`/`audioscriptText`, tạo các dòng `IeltsTest` (status `PENDING_EXTRACTION`).
- **Pass 2 — trích xuất từng kỹ năng** (`runReadingExtraction`/`runListeningExtraction`/`runWritingExtraction`/`runSpeakingExtraction`, chạy song song trong `runFullTestExtraction`): Reading tìm ranh giới từng đoạn văn trước (`detectReadingPassageBoundaries` — đọc tiêu đề "READING PASSAGE n", chỉ gọi AI khi không có tiêu đề này, vd sách General Training) rồi 1 lệnh Groq/đoạn văn (rủi ro nhất, tách nhỏ nhất); Listening 1 lệnh cho cả 4 Section (dữ liệu nhỏ, không cần tách); Writing 1 lệnh cho cả 2 Task (AI được dặn rõ không thấy được chart/hình — giáo viên gắn ảnh tay sau); Speaking 1 lệnh cho cả 3 Part.
- **Pass 3 — khớp đáp án** (`matchAnswersForSkill(testId, skill)`, dùng chung cho cả LISTENING và READING, gọi ngay sau Pass 2 của từng skill): 1 lệnh Groq/Test/skill, input là đúng trang đáp án của Test + kỹ năng đó (`answerKeyTextFor` lọc trang Answer Key có dòng "TEST n" + "LISTENING"/"READING"; không tìm thấy mới dùng cả `answerKeyText`) + danh sách câu hỏi đã tạo, trả về `correctIndex`/`correctAnswer`/`acceptableAnswers` khớp theo `questionNumber`. Writing/Speaking không có bước này (không có đáp án cố định). **Rủi ro lớn nhất của pipeline**: Answer Key lặp số câu theo từng Test, dễ khớp nhầm đề — UI rà soát phải kiểm tra kỹ phần này trước (banner cảnh báo đỏ nếu còn câu chưa khớp).

`runFullTestExtraction` chạy cả 4 skill song song qua `Promise.allSettled`, set 1 status cuối cho `IeltsTest` (`EXTRACTED_DRAFT` nếu không skill nào lỗi, `NEEDS_ATTENTION` nếu có). `runSingleSkillExtraction(testId, skill)` cho phép giáo viên bấm "🔄 Trích xuất lại" từng skill riêng (nút trong UI review) mà không đụng tới 3 skill khác đã rà soát.

### Chấm điểm

- **Listening/Reading** — tự động, deterministic. `backend/src/utils/ieltsAnswerGrading.js` port lại `isReadingAnswerCorrect` từ `frontend/src/lib/readingGrading.ts` (backend không import được file TS của frontend, chấp nhận trùng lặp nhỏ có chủ đích), mở rộng kiểm tra thêm `acceptableAnswers`. Raw score (0-40) → band qua `backend/src/utils/ieltsBandTables.js`.
- **⚠️ Bảng quy đổi band Listening/Reading**: `LISTENING_BAND_TABLE`/`READING_BAND_TABLE_ACADEMIC`/`READING_BAND_TABLE_GT` trong `ieltsBandTables.js` dùng số liệu quy đổi phổ biến (không phải bảng chính thức của 1 đề thi cụ thể — IELTS không công bố 1 bảng chung, mỗi lần thi thật có thể lệch ±1 điểm raw ở ngưỡng). **Nên tra lại nguồn IELTS/Cambridge chính thức và cập nhật nếu có bảng chính xác hơn** trước khi dùng để xếp loại thật.
- **Writing** — AI chấm theo đúng 4 tiêu chí chính thức (Task Achievement/Task Response, Coherence & Cohesion, Lexical Resource, Grammatical Range & Accuracy), qua `ieltsAttempts.routes.js`'s `gradeWritingTask` (2 lệnh Groq song song, Task 1 + Task 2). Khác với tính năng `/writing` luyện thường (rubric CEFR, điểm `internalScore` ẩn) — ở đây band từng tiêu chí là **kết quả hiển thị thật**. Gộp điểm: `backend/src/utils/ieltsRounding.js`'s `combineWritingBand` = (Task1×1 + Task2×2)/3, làm tròn theo `roundIeltsBand`.
- **Speaking** — ghi âm từng Part → upload Supabase (giữ lại, không xoá như `pronunciation.routes.js`) → transcribe qua Whisper (`gradeSpeakingPart`) → AI chấm theo 4 tiêu chí (Fluency & Coherence, Lexical Resource, Grammatical Range & Accuracy, Pronunciation). **Pronunciation chỉ suy đoán qua transcript (ASR)**, không phân tích âm vị học thật — comment luôn kèm cảnh báo rõ điều này (code tự chèn thêm nếu AI quên). Gộp 3 Part: `combineSpeakingBand` = trung bình 3 `overallBand`, làm tròn cùng quy tắc. **Lưu ý thiết kế**: đây là đơn giản hoá so với thực tế IELTS thật (giám khảo thật chấm 1 band duy nhất cho cả bài Speaking, không chấm riêng từng Part rồi lấy trung bình) — buộc phải làm vậy vì kiến trúc app cho nộp từng Part độc lập, không có 1 bản ghi âm liền mạch cả 3 Part để chấm gộp.
- **⚠️ Quy tắc tròn band** (`roundIeltsBand` trong `ieltsRounding.js`): trung bình lẻ .25 tròn lên .5, lẻ .75 tròn lên nguyên band — đây là quy tắc thường được nhắc tới, **nên tra lại nguồn chính thức để xác nhận trước khi dùng thật**.
- Mỗi lần chấm xong đều gọi `prisma.skillPracticeResult.create` trực tiếp (không qua HTTP nội bộ) để nạp vào biểu đồ 4 kỹ năng ở dashboard, quy đổi `score = band/9*10` (band 0-9 → thang 0-10 của biểu đồ).

### Route backend

**[backend/src/routes/ielts.routes.js](backend/src/routes/ielts.routes.js)** (mount `/api/ielts`, giáo viên — quản lý sách/đề, trích xuất, review, publish): `POST /books` (upload PDF, trigger Pass 1) · `GET /books?teacherId=` · `GET /books/:id` · `POST /books/:id/extract-tests` (trigger Pass 2+3 cho cả 4 skill, nhận `testIds?`) · `POST /tests/:id/extract-skill` (trích xuất lại đúng 1 skill) · `GET /tests/:id` (chi tiết đầy đủ, không ẩn đáp án) · `PATCH /tests/:id` · `PATCH /questions/:id`, `/reading-passages/:id`, `/listening-sections/:id`, `/writing-tasks/:id`, `/speaking-parts/:id` · `POST /listening-sections/:id/audio`, `/writing-tasks/:id/image`, `/questions/:id/image` (gắn audio/ảnh tay — AI text-only không tạo được) · `POST /tests/:id/publish` (chặn server-side nếu còn câu Reading/Listening chưa khớp đáp án, section Listening thiếu audio, hoặc chưa xác nhận testType) · `DELETE /books/:id`, `/tests/:id`.

**[backend/src/routes/ieltsAttempts.routes.js](backend/src/routes/ieltsAttempts.routes.js)** (mount `/api/ielts-attempts`, học sinh — làm bài, chấm, lịch sử): `GET /available/:userId?skill=` (đề học sinh thấy được, tổng quát hoá `canAttempt`/`attemptsCount` của `exams.routes.js` cho cả LIBRARY/ASSIGNED) · `GET /tests/:id/listening|reading|writing|speaking?userId=` (Listening/Reading **ẩn đáp án ở tầng server**, không chỉ ẩn UI) · `POST /tests/:id/listening/submit`, `/reading/submit` (trả kèm `review[]` từng câu đúng/sai để học sinh xem lại) · `POST /tests/:id/writing/submit` · `POST /tests/:id/speaking/submit-part` (nộp từng Part, tự tính `overallBand` khi đủ cả 3) · `GET /attempts/:userId?skill=` · `GET /attempts/:skill/:id`.

### Luồng học viên cho TỪNG đề: Làm đề → Học đề → Theo dõi tiến bộ

**[backend/src/routes/ieltsStudy.routes.js](backend/src/routes/ieltsStudy.routes.js)** (mount `/api/ielts-study`), model `IeltsStudySession` (1 dòng / `(skill, attemptId)`, `attemptId` trỏ đa hình tới 1 trong 4 bảng `Ielts*Attempt` nên không có FK; chỉ chủ của attempt mới đọc/ghi được):
1. **Làm đề** — như cũ (`ieltsAttempts.routes.js`): có tính giờ, chấm → band.
2. **Học đề** — ngay dưới màn kết quả của cả 4 trang làm bài, component [frontend/src/components/ielts/IeltsStudyPanel.tsx](frontend/src/components/ielts/IeltsStudyPanel.tsx) hỏi "Bạn có muốn phân tích kỹ hơn cách làm bài để hiểu rõ đề thi hơn?" → `POST /:skill/:attemptId/analysis` (AI chạy song song theo từng Passage/Section/Task/Part, **sinh 1 lần rồi cache** trong `IeltsStudySession.analysis`). Reading/Listening: chỉ giải thích câu SAI/bỏ trống (vì sao đáp án đúng, vì sao học viên sai, câu trích bằng chứng, paraphrase, mẹo) + từ vựng + cấu trúc; Listening lấy transcript bằng cách cắt `IeltsBook.audioscriptText` theo tiêu đề "TEST n"/"SECTION k" (`listeningTranscriptFor`, best-effort — không tìm thấy thì AI giải thích chỉ từ câu hỏi). Writing/Speaking: lỗi cụ thể (câu gốc → câu sửa), nâng cấp từ vựng, dàn ý, bài/câu trả lời mẫu band 7.5-8. Từ vựng có nút nghe (`speechSynthesis`) và "+ Thêm vào Từ Của Tôi" (`POST /api/srs/vocab/custom`). Sau đó hỏi "Bạn có cần bài tập thêm về các câu bị sai không?" → `POST /:skill/:attemptId/practice` sinh 1 bộ bài tập mới (Reading: đoạn văn ngắn + 8 câu cùng dạng câu đã sai; Listening: script đọc bằng giọng máy trình duyệt, script chỉ hiện sau khi nộp; Writing/Speaking: 10 câu sửa lỗi/điền collocation/hoàn thành câu dựa trên lỗi của chính học viên), dùng khuôn `ReadingQuestion` nên chấm client-side bằng `isReadingAnswerCorrect`; kết quả lưu qua `POST /:skill/:attemptId/practice/:setId/result`. Tạo được nhiều bộ. Học viên bấm "Để sau" vẫn học lại được từ tab Lịch Sử ở `/ielts` (nút "Học đề", `autoStart`).
3. **Theo dõi tiến bộ** — `GET /progress/:userId` (4 truy vấn song song, không gọi AI): band gần nhất/trước đó/thay đổi/cao nhất/số ngày chưa luyện cho từng kỹ năng, band Overall ước tính (chỉ khi đủ 4 kỹ năng, làm tròn bằng `roundIeltsBand`), và danh sách thông báo rule-based (tăng/giảm band, kỷ lục mới, ≥14 ngày chưa luyện, kỹ năng yếu nhất thấp hơn mạnh nhất ≥1 band, kỹ năng chưa làm lần nào). Hiển thị ở 3 nơi: khối `IeltsProgressNotice` trên màn kết quả, tab **Tiến Bộ** ở `/ielts` (`IeltsProgressPanel` + biểu đồ `IeltsProgressChart` load lười qua `next/dynamic`) kèm 2 thông báo ở đầu trang, và tối đa 2 thẻ "Tiến bộ IELTS" trong panel Nhận Định của `/dashboard` (hook `useIeltsProgress`).

### Frontend

- **Giáo viên**: tab "Thư Viện Đề Cambridge" (`IELTS_LIBRARY`) trong `/teacher` — 4 thẻ giới thiệu Listening/Reading/Writing/Speaking (AI trích xuất gì, giáo viên phải bổ sung gì; hằng số `IELTS_SKILL_INFO`), form upload PDF + danh sách sách/đề kèm badge trạng thái và 4 chấm L/R/W/S trên mỗi đề (xanh = kỹ năng đã có nội dung, xám = chưa có) lấy từ `_count` mà `GET /api/ielts/books` trả về. Trang review riêng [frontend/src/app/teacher/ielts/[testId]/page.tsx](frontend/src/app/teacher/ielts/[testId]/page.tsx) — 4 tab theo kỹ năng (Reading/Listening/Writing/Speaking), mỗi tab có banner đối chiếu đáp án (nếu áp dụng), form sửa nội dung, nút gắn audio/ảnh tay, nút "🔄 Trích xuất lại" riêng từng skill, cấu hình giao đề (thư viện/gán lớp), nút Publish chung ở đầu trang.
- **Học sinh**: mục "IELTS Cambridge" trong nhóm "Trại Huấn Luyện" ở `/dashboard` (featureKey `ielts`, đã thêm vào `ALL_FEATURES`). Trang [frontend/src/app/ielts/page.tsx](frontend/src/app/ielts/page.tsx) — danh sách đề có thể làm (badge Academic/GT, thư viện/được giao kèm hạn nộp) + tab Lịch Sử (band từng lần làm, bấm mở rộng xem chi tiết rubric). 4 trang làm bài riêng theo kỹ năng dưới `ielts/[testId]/{listening,reading,writing,speaking}/page.tsx`: Listening/Reading có đếm giờ tự nộp + xem lại đáp án đúng/sai sau khi nộp; Writing 2 Task cùng lúc trong 1 khung giờ; Speaking ghi âm từng Part (tái dùng `MediaRecorder`/`getUserMedia` từ `/pronunciation`), Part 2 có đếm giờ chuẩn bị 60s rồi tự chuyển sang ghi âm 120s. Cả 4 trang kết quả đều có nút "📄 Xuất PDF" dùng `SkillReportPDF` (đã mở rộng thêm prop `scoreScale="9"` và field `band?` trên từng rubric item để hiện đúng dạng "Band X.X/9" thay vì "/10").

---

### `/blog` — Blog chia sẻ (công khai) + `/teacher/blog` — soạn bài

**Files:** [frontend/src/app/blog/](frontend/src/app/blog/) (`page.tsx`, `[slug]`, `danh-muc/[slug]`, `tac-gia/[slug]`), [frontend/src/app/teacher/blog/page.tsx](frontend/src/app/teacher/blog/page.tsx), [frontend/src/app/teacher/blog/editor/](frontend/src/app/teacher/blog/editor/) · Component: [frontend/src/components/blog/](frontend/src/components/blog/) · Backend: [backend/src/routes/blog.routes.js](backend/src/routes/blog.routes.js) (mount `/api/blog`) · Model `BlogPost`, `BlogCategory`, `BlogPostRevision` + cột `User.authorSlug/authorTitle/authorBio`

- **Trang công khai là server component** (khác phần lớn app là `"use client"`) để Google đọc được nội dung: fetch qua `blogFetch` ([frontend/src/lib/blog.ts](frontend/src/lib/blog.ts), `next: { revalidate: 60 }` → bài mới/sửa hiện sau tối đa ~1 phút). Thân danh sách dùng chung `BlogListView` + `BlogBanner` cho cả `/blog`, `/blog/danh-muc/[slug]` (trang danh mục riêng, tốt cho SEO) và `/blog/tac-gia/[slug]` (hồ sơ tác giả + JSON-LD `Person`). Link cũ `/blog?category=x` được redirect 308 trong `next.config.ts` (redirect trong page.tsx chỉ ra 200 + meta refresh vì `loading.tsx` đã stream). `/blog/[slug]`: `generateMetadata` (OG `article`), JSON-LD `BlogPosting` + `BreadcrumbList`, mục lục tự sinh từ H2/H3 (≥3 mục), hộp tác giả, bài liên quan, CTA dùng thử 3 ngày. Lượt xem đếm từ client (`POST /posts/:slug/view`, mỗi tab 1 lần/bài); **lượt click** = bấm vào link dẫn tới bài từ thẻ bài viết (danh sách, bài liên quan, dashboard học viên) — link gắn `data-blog-click="<slug>"`, đếm qua `POST /posts/:slug/click` (cột `BlogPost.clicks`). Cả 2 số hiện trên thẻ bài viết và dưới tiêu đề bài, **gần real-time**: `BlogStatsProvider` ([frontend/src/components/blog/BlogStats.tsx](frontend/src/components/blog/BlogStats.tsx), mount ở `app/blog/layout.tsx`) gom slug của mọi bài đang hiện, làm mới bằng 1 request `GET /api/blog/stats?slugs=` mỗi 15 giây + khi tab lấy lại focus (polling, không WebSocket); số chỉ tăng (lấy max) nên dữ liệu ISR cũ không kéo số lùi. **Thời gian giữ chân người đọc** (`BlogReadTracker` cùng file): đếm giây đọc thực sự (tab đang hiện + có tương tác trong 60s gần nhất hoặc đang bật "Nghe bài viết", tối đa 30 phút/lượt) + mốc cuộn 25/50/75/100% phần nội dung, gửi bằng `navigator.sendBeacon` (text/plain, tránh CORS preflight) tới `POST /posts/:slug/read` mỗi khi tab bị ẩn/rời trang/chuyển bài — chỉ cộng dồn vào các cột `readSeconds`/`readSessions`/`scroll25..100` của `BlogPost`, không lưu danh tính. Số liệu này **chỉ trả về ở API quản lý** (`/manage/posts`, `/manage/posts/:id`), không hiện công khai: khối "Thống Kê Bài Viết" đầu trang `/teacher/blog` (KPI tổng + bảng từng bài: lượt xem/click/đọc, thời gian đọc TB, % thời lượng đã đọc so với `readingMinutes`, biểu đồ mức cuộn; tự làm mới 30s) và sidebar trình soạn bài. Helper dẫn xuất `deriveReadStats`/`formatDuration` ở `lib/blog.ts`, widget ở `app/teacher/blog/BlogStatsWidgets.tsx`. `sitemap.ts` thêm bài + danh mục + tác giả.
- **Công khai = `status: PUBLISHED` và `publishedAt <= now`** → ngày đăng ở tương lai = hẹn giờ đăng, không cần cron. Trạng thái: `DRAFT` / `PENDING` (chờ duyệt) / `PUBLISHED`.
- **Phân quyền** (`BLOG_ADMIN_EMAILS` trên backend, danh sách email cách nhau dấu phẩy): admin blog thấy/sửa/xoá mọi bài, duyệt bài, đăng thẳng, chọn tác giả, ghim nổi bật, xoá danh mục. Giáo viên thường chỉ thấy/sửa/xoá bài của mình, bấm "Đăng" thành "Gửi Duyệt" (`PENDING`); bài đã được duyệt thì tác giả sửa tiếp vẫn giữ `PUBLISHED`. **Để trống biến này = mọi giáo viên đều là admin** (hành vi mặc định, không ai bị khoá).
- **Editor**: tên bài, link SEO `lucytutor.online/blog/<slug>` tự sinh theo tên (`slugify` có 2 bản giống nhau ở `backend/src/utils/slugify.js` và `frontend/src/lib/blog.ts`) + kiểm tra trùng realtime, tóm tắt, nội dung ReactQuill (`BlogQuillEditor`), danh mục (thêm mới ngay lúc soạn), thẻ, ảnh bìa, tác giả, ngày giờ đăng, meta title/description + xem trước Google + checklist SEO, xem trước bài, Ctrl+S, cảnh báo rời trang.
  - **Tự lưu 2 lớp**: (1) `localStorage` (`blog_backup_<id|new>`) 1 giây sau mỗi lần sửa — mở lại editor sẽ hỏi khôi phục nếu bản trong máy mới hơn bản trên server; (2) lưu ngầm lên server 30 giây sau khi ngừng gõ (`autosave: true`), **chỉ với bản nháp/chờ duyệt** — server từ chối tự lưu bài đã đăng (409) để bản sửa dở không lộ ra ngoài. Bài mới có tên sẽ tự được tạo thành nháp. `inFlightRef` + `createdHereRef` trong editor tránh tạo 2 bài trùng khi tự lưu và bấm lưu chồng nhau.
  - **Lịch sử chỉnh sửa** (`RevisionsModal`): mỗi lần lưu đè, backend chụp bản cũ vào `BlogPostRevision` (tự lưu chỉ chụp nếu bản gần nhất cũ hơn 10 phút), giữ 30 bản/bài. Khôi phục chỉ nạp vào editor, phải bấm Lưu mới ghi đè (và bản hiện tại lại được chụp lại).
  - **Trợ lý AI** (`AiAssistant`, `POST /manage/ai-suggest`, Groq): gợi ý 5 tên bài, tóm tắt, tiêu đề/mô tả SEO, thẻ — giáo viên bấm "Dùng" từng mục, không tự ghi đè. gpt-oss đôi khi trả lỗi `json_validate_failed` nên route tự thử lại 1 lần + `reasoning_effort: 'low'`.
- **Bài viết liên quan tự chọn** (`RelatedPostsPicker` trong editor, cột `BlogPost.relatedPostIds String[]` — mảng id giữ đúng thứ tự, không phải FK): tác giả tìm bài đã đăng của **mọi** tác giả (`GET /manage/post-picker?q=`, lấy lại theo `?ids=`) để gắn tối đa 6 bài, xếp thứ tự ↑↓, và bấm "Chèn link vào bài" để chèn link `/blog/<slug>` vào nội dung tại vị trí con trỏ (đang bôi đen chữ thì gắn link vào chữ đó) qua `apiRef`/`BlogEditorApi.insertLink` của `BlogQuillEditor` (editor tự nhớ vị trí con trỏ cuối vì bấm sidebar làm mất focus). Lúc lưu, backend bỏ trùng, bỏ chính nó, bỏ id không tồn tại. Trang công khai: bài được chọn đứng trước (đúng thứ tự), bài đã xoá/gỡ đăng/chưa tới giờ đăng tự bị lọc, thiếu 3 bài thì bù bài mới cùng danh mục; để trống = tự gợi ý như cũ.
- **Hồ sơ tác giả**: chức danh/giới thiệu do giáo viên tự khai ở `/teacher/blog` (card "Hồ sơ tác giả"); `authorSlug` tự gán lần đầu đứng tên bài. Avatar phục vụ dạng ảnh qua `GET /authors/:slug/avatar` (giải mã base64 → image, cache 1h) — **không** nhúng base64 vào JSON/HTML bài viết.
- **Email bài mới**: đã gỡ bỏ (10/2026, chưa cần) — từng có form đăng ký + gửi qua SMTP bằng `nodemailer`; nếu làm lại cần thêm bảng người đăng ký + job gửi định kỳ, chú ý bài hẹn giờ và chống gửi trùng.
- **Nghe bài viết** (`BlogAudioPlayer`, ngay dưới tiêu đề `/blog/[slug]`): đọc tiêu đề → tóm tắt → nội dung. **Mặc định giọng ElevenLabs "Trung - Soft, Smooth and Narrative"** (nam miền Nam, id `FTYCiQT21H9XQvhRu0ch`, 10/2026 — user chọn thay cho "Trung Caha" vì 2 giọng Trung Caha trên ElevenLabs đều không phải miền Nam): mỗi khối (tiêu đề/tóm tắt/đoạn văn/ý danh sách) = 1 file mp3 do `POST /api/blog/posts/:slug/tts` tạo **1 lần rồi cache** trong Storage bucket `documents` (`blog-tts/<sha1>.mp3`, hash theo giọng + model + định dạng + nội dung đoạn) → người nghe sau không tốn ký tự, sửa 1 đoạn chỉ tạo lại đoạn đó, chỉ đoạn có người nghe tới mới tốn ký tự. Storage lỗi (vd bị khoá 402 `exceed_egress_quota` — đúng tình trạng lúc 08/10/2026) thì mp3 được giữ trong RAM backend (tối đa 64MB, bỏ file cũ nhất) và phát qua `GET /api/blog/tts-audio/<hash>.mp3` (có hỗ trợ Range cho Safari) — mất khi server khởi động lại, nên Storage hoạt động lại mới thực sự tiết kiệm ký tự. Route chỉ nhận đoạn văn có thật trong bài đã đăng (so khớp chữ+số với tiêu đề/tóm tắt/nội dung) để API key không bị dùng đọc chữ tuỳ ý; viết tắt (THPT, GV...) được chuẩn hoá phía server. Logic gọi ElevenLabs ở [backend/src/utils/elevenlabsTts.js](backend/src/utils/elevenlabsTts.js): env `ELEVENLABS_API_KEY` (bắt buộc), `ELEVENLABS_VOICE_ID` (tuỳ chọn, mặc định id ở trên — giọng Voice Library dùng thẳng bằng id được, không cần thêm vào tài khoản; hoặc `ELEVENLABS_VOICE_NAME` để tự tìm theo tên, cần quyền `voices_read`), `ELEVENLABS_MODEL` (mặc định `eleven_turbo_v2_5` — `eleven_multilingual_v2` **không có tiếng Việt**), `ELEVENLABS_OUTPUT_FORMAT` (mặc định `mp3_22050_32` cho nhẹ egress Supabase). Trình phát dùng 1 thẻ `<audio>` chung, tải trước khối kế tiếp, phát đoạn im lặng lúc bấm để mở khoá autoplay trên iOS; tạm dừng/đọc tiếp đúng giây, đổi tốc độ không phải đọc lại. **Dự phòng**: backend chưa cấu hình / hết ký tự / lỗi → tự chuyển sang **giọng đọc của trình duyệt** (Web Speech API) từ đúng khối đang đọc, có nút "Thử lại giọng AI". Ở chế độ trình duyệt: đọc từng câu ngắn (Chrome tự cắt câu đọc >~15s; pause/resume của giọng Google lỗi nên "Tạm dừng" = huỷ rồi đọc lại từ câu hiện tại), chọn giọng trong các giọng `vi-*` thiết bị có (ưu tiên giọng "Natural/Online"), câu tiếng Anh (không có dấu tiếng Việt, ≥3 từ) đọc bằng giọng Anh nếu có. Chung cho cả 2: tô sáng đoạn đang đọc (`.blog-reading`) + tự cuộn theo, chỉnh tốc độ 0.75–1.5×, thanh mini dính đáy màn hình khi đang nghe. Cài đặt lưu `localStorage` (`blog_tts_prefs`). Trình phát tìm nội dung qua `data-blog-title` / `data-blog-excerpt` / `data-blog-content` — giữ các attribute này khi sửa trang bài viết. **Không dùng regex lookbehind** trong file này (Safari < 16.4 lỗi cú pháp, hỏng cả trang).
- **Dashboard học viên**: `LatestBlogPosts` (3 bài mới nhất) ở tab OVERVIEW, tự ẩn khi chưa có bài.
- **Ảnh**: upload lên Supabase Storage bucket `documents` dưới `blog/` (`POST /manage/upload-image`, ≤5MB). Ảnh dán thẳng (base64) được editor tự upload trước khi lưu; backend lọc HTML bằng `sanitize-html` lúc lưu (chặn script, ảnh `data:`, iframe ngoài YouTube/Vimeo) vì trang công khai render HTML phía server không qua DOMPurify.
- CSS nội dung bài: `.blog-content` trong `globals.css` (Quill 2 xuất mọi danh sách dạng `<ol><li data-list="bullet">` nên phải tự đổi kiểu đánh dấu).

---

### `/administrator` — Trang quản trị toàn app

**File:** [frontend/src/app/administrator/page.tsx](frontend/src/app/administrator/page.tsx) (+ `_components/`: `OverviewTab`, `FinanceTab`, `UsersTab`, `AdminCharts` load lười qua `next/dynamic`, `ui.tsx`) · API client [frontend/src/lib/adminApi.ts](frontend/src/lib/adminApi.ts) · Backend [backend/src/routes/admin.routes.js](backend/src/routes/admin.routes.js) (mount `/api/admin`) + [backend/src/utils/adminAuth.js](backend/src/utils/adminAuth.js) · Model `AdminTransaction`

- **Tài khoản quản trị là loại tài khoản riêng (`User.role = "ADMIN"`)**, không phải giáo viên/học viên được cấp thêm quyền. **Chỉ tạo bằng script** `cd backend && node scripts/createAdmin.js --email <email> --name "<tên>"` (hỏi mật khẩu gõ ẩn, ≥8 ký tự; từ chối email đang là tài khoản học viên/giáo viên — phải dùng email khác; chạy lại với email admin đã có = đặt lại mật khẩu). Không có API/giao diện nào tạo admin hay đổi role. Admin tự đổi mật khẩu ở sidebar (`PUT /api/admin/change-password`)
- **Đăng nhập riêng, không dùng phiên userId** của học viên/giáo viên (trang có số liệu tài chính + quản lý tài khoản): `POST /api/admin/login` (email + mật khẩu, bcrypt) chỉ nhận tài khoản role ADMIN → token = payload base64url + chữ ký HMAC-SHA256 (`ADMIN_TOKEN_SECRET`; không đặt thì sinh ngẫu nhiên lúc khởi động → khởi động lại server là phải đăng nhập lại), hết hạn 12 giờ. Mọi route khác yêu cầu `Authorization: Bearer <token>` và **kiểm tra lại tài khoản vẫn là ADMIN** (cache 60 giây) — token ký đúng nhưng của tài khoản khác role bị từ chối. Sai mật khẩu 5 lần/15 phút (theo IP + email) bị chặn tạm. FE lưu token ở `sessionStorage` (đóng tab = đăng xuất), gặp 401 thì quay về form đăng nhập. Trang `noindex` + chặn trong `robots.ts`
- **Tổng quan** (`GET /overview`): số học viên/giáo viên/lớp, đăng ký mới 12 tháng (raw SQL `date_trunc` theo `Asia/Ho_Chi_Minh`), hoạt động 7/30 ngày (`lastActive`), học viên tự do theo trạng thái (dùng thử / đang hoạt động = đã có `FreeStudentPayment` / đã khoá / miễn trừ = không có `accessExpiresAt`), số bài blog, tài chính tháng này
- **Thu chi & lợi nhuận**: sổ thu chi **nhập tay** (`AdminTransaction`: `type` INCOME/EXPENSE, `category` tự đặt có gợi ý, `amount` VND nguyên dương, `date`, `note`, `recurring`). Lợi nhuận = thu nhập − chi phí của khoản nhập tay. **Học phí thu qua app (`TuitionPayment` PAID + `FreeStudentPayment`) chỉ hiện ở cột tham khảo, KHÔNG cộng vào thu nhập/lợi nhuận** (theo yêu cầu: thu nhập chỉ tính khoản nhập tay — muốn tính thì nhập thành 1 khoản thu). Ngày lưu lúc **12:00 giờ VN** và mọi gom nhóm theo tháng dùng ranh giới tháng giờ VN (server chạy UTC) để khoản ngày 1 hay ngày cuối tháng không nhảy sang tháng khác. "Chép khoản cố định tháng trước" (`POST /finance/copy-recurring`) chép các khoản `recurring` của tháng trước, giữ ngày trong tháng (31 → ngày cuối tháng ngắn hơn), bỏ qua khoản đã có (cùng loại + danh mục + số tiền + ghi chú) nên bấm nhiều lần không trùng. Giao diện: chọn năm + chip 12 tháng, 4 KPI tháng (so với tháng trước), sổ thu chi tháng (thêm/sửa/xoá qua `Modal`), cơ cấu theo danh mục, biểu đồ + bảng 12 tháng (bấm để chọn tháng)
- **Người dùng** (`GET /users`, không trả mật khẩu/avatar): tìm kiếm bỏ dấu, lọc vai trò/học viên tự do, phân trang `usePagination`. **Tạo tài khoản giáo viên** (`POST /users/teacher`, mật khẩu mặc định `123456`) — giáo viên không tự đăng ký được ở `/auth` nên đây là cách cấp tài khoản. **Đặt lại mật khẩu** về mặc định (`POST /users/:id/reset-password`) — chỉ cho tài khoản STUDENT/TEACHER; mật khẩu ADMIN chỉ do chính admin đó hoặc script đổi (1 admin không chiếm được tài khoản admin khác). Không có xoá tài khoản/đổi vai trò (cascade xoá rất rộng). ⚠️ Trang `/teacher` hiện chưa có chỗ đổi mật khẩu (chỉ dashboard học viên có)
- Tên/email người dùng chèn vào HTML của SweetAlert phải escape (`esc` trong `UsersTab`)

---

### `/phonetics` — Bảng Âm IPA

**File:** [frontend/src/app/phonetics/page.tsx](frontend/src/app/phonetics/page.tsx)

Bảng tra cứu 44 âm tiếng Anh (British English) theo đúng layout kinh điển **Adrian Underhill Phonemic Chart** — không phải trang tự luyện, chỉ có bấm để nghe + xem giải thích cách phát âm (không ghi âm/chấm điểm, khác `/pronunciation`).

- **Thứ tự hiển thị khớp đúng bảng gốc**: Nguyên âm đơn 4 cột × 3 hàng (`iː ɪ ʊ uː` / `e ə ɜː ɔː` / `æ ʌ ɑː ɒ`), nguyên âm đôi so le 2-3-3 hàng (`ɪə eɪ` / `ʊə ɔɪ əʊ` / `eə aɪ aʊ` — component `PhonemeGroup` nhận `rowSizes` để chèn ô trống đúng vị trí), phụ âm 8 cột × 3 hàng (`p b t d tʃ dʒ k g` / `f v θ ð s z ʃ ʒ` / `m n ŋ h l r w j`).
- **Màu phân biệt voiced/unvoiced cho phụ âm**: mỗi phoneme trong `CONSONANTS` có field `voiced?: boolean`; `showVoicing` prop trên `PhonemeGroup` tô nền/viền xanh ngọc (voiced) hoặc xám trung tính (unvoiced), có chú thích màu ở cuối trang. Nguyên âm/nguyên âm đôi không có phân biệt này (nguyên âm tiếng Anh luôn hữu thanh).
- **Responsive**: bảng phụ âm (8 cột, cần ~700px) tự co còn 4 cột trên điện thoại (`isMobile` theo dõi qua `matchMedia`, `PhonemeGroup` nhận thêm prop `isMobile` để giới hạn cột) thay vì bắt cuộn ngang liên tục. Panel chi tiết bên trái chỉ `sticky`/giới hạn chiều cao trên desktop (`lg:sticky lg:top-0`) — trên mobile nó nằm trong luồng thường để không chặn cuộn xuống bảng phoneme.

---

### Hạ tầng dùng chung cho 4 kỹ năng (Reading/Writing/Speaking/Listening)

- **Cấp độ & mục đích luyện tập**: [frontend/src/lib/skillPractice.ts](frontend/src/lib/skillPractice.ts) export `CEFR_LEVELS` (A1-C1) và `PRACTICE_PURPOSES` (`IELTS` / `GENERAL` — giao tiếp), dùng chung ở cả 4 trang luyện tập. Backend nhận `level`/`purpose` ở các endpoint sinh đề (`ai.routes.js`, `speaking-conversation.routes.js`, `listening.routes.js`) để điều chỉnh văn phong/độ khó/tiêu chí chấm cho phù hợp.
- **Xuất PDF báo cáo luyện tập**: [frontend/src/components/reports/SkillReportPDF.tsx](frontend/src/components/reports/SkillReportPDF.tsx) là component dùng chung (logo LucyTutor, tên học viên, **ngày giờ thực hành** để học viên tracking, cấp độ/mục đích, nhận xét tổng quan, bảng rubric, gợi ý cải thiện, nội dung bài làm/hội thoại/bài đọc), render off-screen rồi chụp bằng [frontend/src/lib/pdfExport.ts](frontend/src/lib/pdfExport.ts) (`exportNodeToPDF`, dùng `html-to-image` → `jsPDF`, tự động chia nhiều trang nếu nội dung dài hơn 1 trang — khác `TuitionInvoice` vốn chỉ có đúng 1 trang cố định).
- **Lịch sử luyện tập**: Writing (`WritingSubmission`), Reading (`ReadingAttempt`), Listening đề luyện nghe (`ListeningExamAttempt`) đều có model Prisma riêng lưu lại đề/bài làm/nhận xét/điểm + `practicedAt`. Speaking tái dùng `SpeakingSession` đã có sẵn (nay cho phép `topicId` null khi học viên tự chọn ngữ cảnh). Tất cả đều tiếp tục gọi `POST /api/skill-progress/log` như trước để nuôi biểu đồ 4 kỹ năng ở Dashboard — không đổi cơ chế này.

---

### `/listening` — Luyện Nghe (tra từ vựng theo audio, kiểu YouGlish) + Đề Luyện Nghe

**File:** [frontend/src/app/listening/page.tsx](frontend/src/app/listening/page.tsx)

Không còn là trang demo tĩnh (3 bài IELTS hardcode) — đã thay hoàn toàn bằng tính năng nghe từ vựng theo ngữ cảnh thật:

- Ghép **toàn bộ từ vựng trong deck SRS của học viên** (không chỉ từ đến hạn — soonest-due được ưu tiên nhưng không bắt buộc, khác `/gym`) với các audio clip giáo viên đã upload có chứa từ đó (`GET /api/listening/queue/:userId`), xếp thành hàng đợi tối đa **10 mục/lần nạp**. Audio nào giáo viên đã gán cho học viên/lớp nhưng không khớp từ nào trong deck của học viên đó vẫn được đưa vào hàng đợi dưới dạng mục **"🎧 Nghe tự do"** (tự chọn 1 từ hợp lý trong script, không có `progressId`, không tính vào lịch ôn SRS) — đảm bảo **mọi audio đã gán luôn truy cập được bất kỳ lúc nào**, không phụ thuộc lịch ôn tập SRS vốn khác nhau theo từng học viên (trước đây cùng 1 audio có thể hiện với học viên này nhưng biến mất với học viên khác)
- Mỗi từ đi qua **2 giai đoạn** (`phase` state, không cho nhảy cóc):
  1. **Xem & Nghe Từ Trong Câu (EXPLORE)** — hiện nguyên câu chứa từ mục tiêu (không che), từ mục tiêu được bôi đậm/gạch chân và có thể bấm vào để nghe lại; audio tự seek + phát **nguyên câu** (không phải chỉ 1 từ đơn lẻ) rồi tự dừng cuối câu. Có thể chuyển đổi giữa nhiều "Ví dụ" (clip) nếu từ khớp nhiều audio khác nhau
  2. **Kiểm Tra (TEST)** — bấm "Bắt Đầu Kiểm Tra" để chuyển sang; câu vẫn hiện nhưng từ mục tiêu bị che thành gạch chân trống, học sinh gõ lại từ đã nghe (dictation) — tái dùng nguyên bộ chấm điểm ở [frontend/src/lib/textGrading.ts](frontend/src/lib/textGrading.ts) (`cleanString`, `levenshteinDistance`, `getHintMask`, cũng dùng chung với `/gym` và `/grammar-gym`)
  3. Sau khi nộp: hiện đáp án đúng/sai, câu đã test (từ mục tiêu bôi đậm), **và toàn bộ transcript gốc của audio** (từ mục tiêu highlight bằng `highlightWords`, khớp không phân biệt hoa/thường qua word-boundary regex) kèm nút "▶ Nghe Toàn Bộ" phát lại **cả file audio từ đầu** (không chỉ câu vừa test) — dùng `playingFullRef` để bỏ qua auto-pause-cuối-câu khi đang phát toàn bộ
- Kết quả (quality 1/3/4/5) gọi thẳng `POST /api/srs/review/:progressId` — luyện nghe và ôn từ vựng dùng chung 1 hệ thống SRS, không tách tracking riêng. Với mục "Nghe tự do" (không có `progressId` thật) thì bỏ qua bước gọi SRS, chỉ log qua `skill-progress` (`source: "LISTENING_FREE"`)
- **Không chia phiên (session)**: hàng đợi vẫn nạp tối đa 10 từ/lần (`BATCH_SIZE` ở backend), nhưng khi học sinh học hết batch hiện tại, `goNext` tự động gọi lại `GET /api/listening/queue/:userId` và nạp tiếp ngay tại chỗ (hiện spinner ngắn `loadingMore`, không có màn hình "hoàn thành phiên" chặn lại) — học sinh luôn ở trong màn luyện nghe và có thể học liên tục không giới hạn số từ/lượt truy cập. Chỉ khi API trả về mảng rỗng (hết từ đến hạn) mới hiện màn "Chưa có audio để luyện nghe"
- **Bộ lọc giọng đọc (accent)**: mỗi `ListeningClip` có field `accent` ("UK"/"US"/"AUS") do giáo viên chọn lúc upload. Học sinh lọc hàng đợi theo giọng qua thanh chọn (Tất cả/UK/US/AUS) ở đầu trang `/listening`, truyền `?accent=` cho `GET /api/listening/queue/:userId` (và `GET /api/listening/search`); đổi giọng sẽ refetch lại hàng đợi từ đầu (và reset `sessionLog`)
- Mỗi `ListeningClip` còn có field `level` (CEFR "A1".."C1", bắt buộc chọn khi giáo viên upload/sửa ở Studio Luyện Nghe) — validate ở backend qua `ALLOWED_LEVELS` trong `listening.routes.js`, dùng làm giá trị mặc định hợp lý khi học viên tạo Đề Luyện Nghe từ clip đó
- **🎧 Đề Luyện Nghe (tab riêng, `pageMode` state)** — tách biệt hoàn toàn khỏi luồng SRS ở trên: học viên chọn 1 audio đã được gán cho mình/lớp, chọn cấp độ (A1-C1) + mục đích (IELTS/giao tiếp) + số câu, AI sinh câu hỏi trắc nghiệm + điền từ **dựa hoàn toàn trên script gốc** của giáo viên (không phải bản Whisper tự nhận dạng). Tự chấm điểm client-side (tái dùng `isReadingAnswerCorrect`/`FILL_TYPES` từ `readingGrading.ts`), log điểm qua `skill-progress` (`source: "LISTENING_EXAM"`), lưu lịch sử vào `ListeningExamAttempt`, xuất PDF kèm ngày giờ thực hành

**Backend:** [backend/src/routes/listening.routes.js](backend/src/routes/listening.routes.js) — khi giáo viên upload, chạy nền (fire-and-forget, không chặn response) Groq Whisper (`whisper-large-v3`, `timestamp_granularities: ['word']`) lấy timestamp từng từ trong audio, lưu vào `ListeningClip.alignment` (JSON string). Transcript hiển thị cho học sinh luôn là script gốc giáo viên nhập (không phải text Whisper tự nhận dạng) — Whisper chỉ dùng để lấy mốc thời gian, tránh lỗi nghe nhầm của ASR lọt vào phụ đề. `matchClipsForWord` (trong file này) neo từ khớp được vào vị trí của nó trong mảng `alignment`, rồi dùng số lượng token của câu (từ `findSentenceMatch` trên script gốc) để suy ra khoảng `start`/`end` của **cả câu** — không chỉ mốc thời gian của riêng từ đó. Đề Luyện Nghe dùng 4 route riêng dưới `/exam/*` (`GET /exam/clips/:userId`, `POST /exam/generate`, `POST /exam/attempts`, `GET /exam/attempts/:userId`) trong cùng file.

---

### `/reading` — Luyện Đọc Hiểu (AI sinh đề)

**File:** [frontend/src/app/reading/page.tsx](frontend/src/app/reading/page.tsx)

- Học viên chọn chủ đề (tự do hoặc gợi ý), **cấp độ CEFR (A1-C1)**, **mục đích** (IELTS/giao tiếp), độ dài văn bản, và **chọn nhiều dạng câu hỏi cùng lúc** (tối đa 10 dạng — xem `QUESTION_TYPE_META` trong [frontend/src/lib/readingGrading.ts](frontend/src/lib/readingGrading.ts): Trắc nghiệm, Đúng/Sai, Điền từ, Yes/No/Not Given, Nối tiêu đề đoạn văn, Nối thông tin, Nối đặc điểm, Hoàn thành tóm tắt, Hoàn thành câu, Trả lời ngắn). Mọi dạng đều quy về 2 cơ chế chấm điểm dùng chung: chọn theo `correctIndex` (có `options`) hoặc so khớp văn bản tự do (`FILL_TYPES`, dung sai Levenshtein) — không cần logic chấm riêng cho từng dạng
- Backend (`POST /api/ai/generate-reading-passage`) tự thêm hướng dẫn chia đoạn văn có nhãn chữ cái (A, B, C...) khi đề có các dạng cần tham chiếu đoạn văn (Matching Heading/Information/Features)
- Sau khi nộp bài (chấm tự động client-side như cũ): có nút **"🤖 Đánh Giá Chi Tiết (AI)"** gọi `POST /api/ai/reading-analysis` — AI phân tích kỹ theo **từng dạng câu hỏi** đã làm (không chỉ đúng/sai chung chung), đưa chiến thuật làm bài phù hợp từng dạng
- **Lịch sử** (`ReadingAttempt` — mới, trước đây bài đọc hoàn toàn ephemeral): mỗi lần nộp bài tự lưu passage/câu hỏi/đáp án/điểm/`practicedAt`; phân tích AI (nếu đã bấm) được `PATCH /api/ai/reading-attempts/:id` bổ sung sau
- **Xuất PDF** báo cáo (kèm ngày giờ thực hành) bên cạnh nút xuất Word đã có sẵn
- **Tra nghĩa từ vựng real-time trong bài đọc** (`WordLookupText`, [frontend/src/components/reading/WordLookupText.tsx](frontend/src/components/reading/WordLookupText.tsx)) — dùng ở cả bài đọc đang luyện lẫn khi xem lại Lịch Sử. Toàn bộ `passage.passage` (vốn là text thường, không phải HTML) được tokenize thành từng từ bọc `<span>` riêng, giữ nguyên khoảng trắng/dấu câu/xuống dòng. **Bấm** (không phải hover) vào 1 từ để tra — hover chỉ gạch chân chấm gợi ý — nhằm không tốn gọi AI khi rê chuột ngang qua và hoạt động được trên mobile (không có hover). Gọi `POST /api/ai/lookup-word` (Groq) kèm cả câu chứa từ đó (tự tách câu bằng regex đơn giản theo dấu `.!?`) để dịch **theo đúng ngữ cảnh** thay vì tra từ điển tĩnh (nghĩa tiếng Anh phụ thuộc ngữ cảnh câu rất nhiều). Kết quả cache theo từ trong session (bấm lại từ đã tra không gọi lại API). Popup kết quả có nút "+ Thêm vào Từ Của Tôi" gọi thẳng `POST /api/srs/vocab/custom` đã có sẵn — nối 2 tính năng có sẵn (Reading + tự thêm từ SRS) mà không cần API mới cho phần lưu từ

---

### `/writing` — Luyện Viết (AI chấm chi tiết)

**File:** [frontend/src/app/writing/page.tsx](frontend/src/app/writing/page.tsx)

- 3 tab: **✍️ Luyện Tập** / **🔖 Đề Đã Lưu** / **📜 Lịch Sử**
- Chọn **cấp độ CEFR (A1-C1)** + **mục đích** (IELTS/giao tiếp) thay vì 3 mức cơ bản/trung cấp/nâng cao cũ — ảnh hưởng cả cách AI ra đề (`generate-writing-prompt`) lẫn cách chấm (`writing-feedback`)
- Rubric chấm điểm có thêm chiều **"Độ dễ đọc"** (`clarity`) — đánh giá bài viết có mạch lạc, dễ hiểu cho người đọc hay không, tách biệt với ngữ pháp/từ vựng/bố cục
- **"🔖 Lưu đề để luyện lại sau"**: lưu cặp đề Anh/Việt hiện tại vào `SavedWritingPrompt` (field `prompt` lưu JSON `{promptEn, promptVi}`), xem lại và luyện ngay ở tab Đề Đã Lưu
- **Lịch sử** (`WritingSubmission` — mới): mỗi bài nộp (kèm feedback đầy đủ) tự lưu lại, xem lại được từng bài cũ
- **Xuất PDF** báo cáo (kèm ngày giờ thực hành) bên cạnh nút xuất Word đã có sẵn

---

### `/conversation` — Luyện Nói Cùng AI (Speaking)

**File:** [frontend/src/app/conversation/page.tsx](frontend/src/app/conversation/page.tsx)

- Trước đây học viên **chỉ chọn được trong danh sách chủ đề giáo viên gán sẵn** (`SpeakingTopic`). Nay có thêm mục **"Tự Chọn Ngữ Cảnh Hội Thoại"**: học viên tự nhập ngữ cảnh bất kỳ (có gợi ý sẵn) + chọn **cấp độ CEFR** + **mục đích** (IELTS/giao tiếp) → gọi `POST /api/speaking-conversation/sessions/self` (persona AI dựng động qua `buildSelfPersona` trong `speaking-conversation.routes.js`, không cần giáo viên tạo `SpeakingTopic` trước). Danh sách chủ đề giáo viên gán vẫn hiển thị song song bên dưới
- `SpeakingSession.topicId` nay là optional — session tự chọn lưu `contextText`/`level`/`purpose` trực tiếp trên session thay vì tham chiếu `SpeakingTopic`
- Nhận xét cuối buổi (`POST .../sessions/:id/finish`) có thêm chiều **"Độ dễ nghe"** (`clarity`) — đánh giá lời nói (qua transcript) có mạch lạc, dễ theo dõi cho người nghe không, KHÔNG chấm phát âm (vì đây là bản ghi chữ)
- **Tab Lịch Sử** (tái dùng endpoint `GET /sessions/user/:userId` vốn đã có sẵn nhưng trước đây không được dùng): xem lại hội thoại + nhận xét cũ
- **Xuất PDF** báo cáo buổi luyện nói (kèm ngày giờ thực hành)
- **Luôn trả lời bằng tiếng Anh, bất kể persona viết bằng ngôn ngữ nào**: helper `enforceEnglish(persona)` trong `speaking-conversation.routes.js` append thêm chỉ dẫn "LUÔN LUÔN trả lời bằng tiếng Anh" vào cuối system persona trước khi gọi Groq — áp dụng cho cả câu mở đầu lẫn mọi lượt hội thoại. Lý do: `SpeakingTopic.aiPersona` do **giáo viên** tự viết (thường bằng tiếng Việt), nếu không ép buộc thì AI có xu hướng trả lời cùng ngôn ngữ với system prompt → phá luồng luyện nói tiếng Anh. `buildSelfPersona()` (ngữ cảnh học viên tự chọn) vốn đã có sẵn chỉ dẫn này nên không cần bọc lại.

---

### `/lesson/[id]` — Xem bài học

**File:** [frontend/src/app/lesson/[id]/page.tsx](frontend/src/app/lesson/[id]/page.tsx)

Hiển thị nội dung bài học do giáo viên tạo (HTML từ ReactQuill). Render qua `DOMPurify.sanitize` + `dangerouslySetInnerHTML`.

---

### `/mistakes` — Sổ tay lỗi sai

**File:** [frontend/src/app/mistakes/page.tsx](frontend/src/app/mistakes/page.tsx)

Danh sách các câu làm sai được tự động lưu sau mỗi bài thi. Lọc theo chuyên đề, xuất PDF ôn tập.

---

## Layout toàn cục

**File:** [frontend/src/app/layout.tsx](frontend/src/app/layout.tsx)

```
<html>
  <body>
    <header sticky>  ← Logo LUCYTUTOR + slogan
    <main flex-1>    ← {children}
  </body>
</html>
```

Header luôn hiển thị, không có sidebar toàn cục — mỗi dashboard tự quản lý navigation bằng tabs.

---

## PWA (Progressive Web App)

Cho phép học sinh cài app lên điện thoại (Add to Home Screen):

- `frontend/public/manifest.json` — tên app, icon (`/logo.png`), `start_url: "/dashboard"`, `scope: "/"`, `display: "standalone"`
- `frontend/public/sw.js` — service worker tối giản: cache trang `/offline.html` + `/logo.png` khi install, network-first cho navigation, fallback về trang offline khi mất mạng. Không cache API/data
- `frontend/public/offline.html` — trang tĩnh hiển thị khi mất kết nối
- `PWARegister` (mount trong `layout.tsx`) — đăng ký `sw.js`, chỉ chạy khi `NODE_ENV === "production"` (tránh cache đè lên HMR lúc dev)
- `InstallPWAButton` (hiện ở header dashboard học sinh) — bắt sự kiện `beforeinstallprompt` để hiện nút cài đặt; trên iOS Safari (không hỗ trợ `beforeinstallprompt`) hiển thị hướng dẫn "Chia sẻ → Thêm vào Màn hình chính"
- `layout.tsx` khai báo `manifest: "/manifest.json"`, `appleWebApp`, và `viewport.themeColor`

**Lưu ý:** `logo.png` thực chất là ảnh JPEG 1024x1024 mang đuôi `.png` — dùng trực tiếp làm icon PWA (192x192/512x512), chưa qua resize thật sự vì môi trường build không có công cụ xử lý ảnh (ImageMagick/sharp).

---

## Components dùng chung

| Component | File | Mô tả |
|---|---|---|
| `AskAIButton` | [frontend/src/components/AskAIButton.tsx](frontend/src/components/AskAIButton.tsx) | Nút gọi AI giải thích câu sai |
| `CalendarComponent` | [frontend/src/components/calendar/CalendarComponent.tsx](frontend/src/components/calendar/CalendarComponent.tsx) | Wrapper FullCalendar v6 |
| `TuitionInvoice` | [frontend/src/components/tuition/TuitionInvoice.tsx](frontend/src/components/tuition/TuitionInvoice.tsx) | Template hóa đơn học phí xuất PDF |
| `PWARegister` | [frontend/src/components/PWARegister.tsx](frontend/src/components/PWARegister.tsx) | Đăng ký service worker (`/sw.js`), mount trong `layout.tsx`, chỉ chạy ở production |
| `InstallPWAButton` | [frontend/src/components/InstallPWAButton.tsx](frontend/src/components/InstallPWAButton.tsx) | Nút "Cài Đặt Ứng Dụng" dùng sự kiện `beforeinstallprompt`; hiện hướng dẫn thủ công trên iOS |
| `Pagination` | [frontend/src/components/Pagination.tsx](frontend/src/components/Pagination.tsx) | Thanh phân trang dùng chung (nút Trước/Sau + số trang + "Hiển thị X-Y / Z"), style bằng token `text-foreground`/`bg-foreground` nên dùng được cả ở trang học sinh (dark-mode-aware) lẫn trang giáo viên |

**Phân trang danh sách:** mọi danh sách dài (Ngân Hàng Đề Thi/Bài Học, Học Viên, Kho Tài Liệu, Kiểm Soát Gian Lận, Studio Luyện Nghe, Chủ Đề Hội Thoại, Báo Cáo Học Phí, Bảng Xếp Hạng ở cả 2 dashboard, và lịch sử luyện tập Reading/Writing/Speaking/Listening) dùng chung hook [frontend/src/lib/usePagination.ts](frontend/src/lib/usePagination.ts) (`usePagination(items, pageSize, resetKey?)`). Nguyên tắc bắt buộc: **luôn filter/search trên toàn bộ danh sách gốc trước, rồi mới đưa kết quả đã lọc vào `usePagination`** — không bao giờ filter sau khi đã cắt trang, để tìm kiếm/lọc luôn khớp trên cả danh sách chứ không chỉ trang hiện tại. `resetKey` (thường là chuỗi ghép các giá trị search/filter) khiến trang tự nhảy về 1 khi điều kiện lọc đổi, tránh đứng ở trang cũ trống dữ liệu.

⚠️ Vì `usePagination` gọi hook React (`useState`/`useEffect`), nó **phải được gọi ở top-level của component**, không được gọi bên trong một hàm IIFE `(() => {...})()` lồng trong JSX (vi phạm rules of hooks). Cách làm trong `teacher/page.tsx` và `dashboard/page.tsx`: tính toán mảng đã lọc (`filteredExams`, `filteredStudents`,...) và gọi `usePagination` ngay ở thân component (cạnh các biến dẫn xuất khác), rồi bên trong JSX/IIFE chỉ tham chiếu `.pageItems` để render.

---

## Auth & Session

- Không dùng NextAuth — tự quản lý bằng `userId` trong `localStorage` / `sessionStorage`
- `localStorage`: nhớ đăng nhập lâu dài ("Nhớ tôi")
- `sessionStorage`: chỉ nhớ trong tab hiện tại
- Mỗi trang dashboard tự fetch `/api/auth/me?userId=...` khi mount để lấy thông tin user đầy đủ
- **Luôn đọc/ghi phiên qua [frontend/src/lib/session.ts](frontend/src/lib/session.ts)** (`getSessionUserId`, `setSessionUserId(id, remember)`, `clearSession`) — không tự gọi `localStorage/sessionStorage.getItem('userId')`. Trước đây đăng nhập chỉ ghi 1 nơi mà không xoá nơi kia, còn các trang đọc `localStorage || sessionStorage` → trên máy dùng chung, userId "Nhớ tôi" của người trước luôn thắng (học viên A mở app thấy tài khoản học viên B). Nay đăng nhập/đăng xuất luôn dọn cả 2 nơi; nếu 2 nơi có 2 userId khác nhau thì xoá hết, bắt đăng nhập lại
- **Chặn sai trang theo role** (3 loại tài khoản tách biệt — xem mục `/auth`): `/dashboard` chỉ cho STUDENT (TEACHER → `/teacher`, PWA luôn mở `start_url: /dashboard`), `/teacher`, `/teacher/ielts/[testId]`, `/teacher/blog` chỉ cho TEACHER (STUDENT → `/dashboard`); tài khoản ADMIN lọt vào luồng userId ở bất kỳ trang nào bị xoá phiên + về `/auth` (`redirectToOwnArea`). `/me` trả 404 (tài khoản đã bị xoá) → `clearSession()` + về `/auth`

---

## Backend — API chính

**Base URL:** `http://localhost:5000` (dev)

| Route | Mô tả |
|---|---|
| `POST /api/auth/signin` | Đăng nhập |
| `POST /api/auth/signup` | Đăng ký |
| `GET /api/auth/me?userId=` | Lấy thông tin user |
| `PUT /api/auth/avatar/:id` | Cập nhật avatar (base64) |
| `GET /api/exams` | Danh sách đề thi |
| `POST /api/exams/:id/submit` | Nộp bài thi |
| `POST /api/exams/cheat` | Ghi nhận gian lận |
| `GET /api/lessons/classroom/:id` | Bài học theo lớp |
| `GET /api/lessons/teacher/:teacherId` | Toàn bộ bài học của giáo viên (kèm `classroom`, dùng để lọc theo lớp ở FE) |
| `POST /api/classroom/join` | Tham gia lớp bằng mã |
| `POST /api/classroom/add-student` | Giáo viên thêm học viên thủ công (mật khẩu mặc định `123456`) và gán vào 1 hoặc nhiều lớp cùng lúc |
| `DELETE /api/classroom/:id` | Xóa lớp học (cascade xóa bài học/đề thi/tài liệu/điểm danh/học phí liên quan) |
| `GET /api/documents` | Danh sách tài liệu (`?classroomId=`, `?teacherId=`). Upload chấp nhận `.pdf`, `.doc`, `.docx`, `.ppt`, `.pptx` |
| `GET /api/attendance/report/:classroomId` | Báo cáo học phí theo tháng của 1 lớp |
| `GET /api/attendance/report/teacher/:teacherId` | Báo cáo học phí tổng hợp TẤT CẢ lớp của giáo viên theo tháng (tổng đã thu, tổng cần thu, danh sách đã đóng/chưa đóng) — dùng cho tab OVERVIEW |
| `GET /api/attendance/month/teacher/:teacherId` | Điểm danh thô (`classroomId, userId, date, status`) cả tháng của TẤT CẢ lớp một giáo viên — dùng để dựng lưới điểm danh trực quan ở tab ATTENDANCE > Điểm Danh |
| `GET /api/analytics/...` | Thống kê học tập |
| `POST /api/ai/...` | AI feedback (Groq) |
| `POST /api/listening/upload` | Giáo viên upload audio + script (multipart, field `audio`), lưu Supabase Storage bucket `documents` dưới `listening/`, chạy nền Groq Whisper lấy timestamp từng từ |
| `GET /api/listening?teacherId=` | Danh sách audio đã upload của giáo viên (kèm trạng thái xử lý) |
| `GET /api/listening/queue/:userId` | Hàng đợi luyện nghe: toàn bộ deck SRS ghép với audio clip khớp (không chỉ từ đến hạn) + audio đã gán nhưng không khớp từ nào (mục "Nghe tự do"), tối đa 10 mục/lần nạp |
| `GET /api/listening/search?userId=&word=` | Tra tự do 1 từ bất kỳ ra các audio clip khớp (không giới hạn theo SRS) |
| `GET /api/listening/exam/clips/:userId` | Danh sách audio khả dụng để học viên tạo Đề Luyện Nghe |
| `POST /api/listening/exam/generate` | Sinh câu hỏi luyện nghe (trắc nghiệm/điền từ) từ script gốc của 1 clip, theo `level`/`purpose` |
| `POST /api/listening/exam/attempts` · `GET /api/listening/exam/attempts/:userId` | Lưu/xem lịch sử Đề Luyện Nghe |
| `POST /api/ai/generate-reading-passage` | Sinh bài đọc + câu hỏi theo `level`/`purpose`/`questionTypes[]` (tối đa 10 dạng) |
| `POST /api/ai/lookup-word` | Tra nghĩa 1 từ theo ngữ cảnh câu chứa nó (bấm từ trong bài đọc ở `/reading`) |
| `POST /api/ai/reading-analysis` | AI phân tích kỹ theo từng dạng câu hỏi sau khi học viên nộp bài đọc |
| `POST /api/ai/reading-attempts` · `GET .../reading-attempts/:userId` · `PATCH .../reading-attempts/:id` | Lưu/xem lịch sử bài đọc, cập nhật phân tích AI sau |
| `POST /api/ai/generate-writing-prompt` · `POST /api/ai/writing-feedback` | Sinh đề viết + chấm chi tiết theo `level`/`purpose`, rubric có thêm `clarity` |
| `POST /api/ai/writing-submissions` · `GET .../writing-submissions/:userId` | Lưu/xem lịch sử bài viết |
| `POST /api/ai/writing-saved-prompts` · `GET .../writing-saved-prompts/:userId` · `DELETE .../writing-saved-prompts/:id` | Lưu đề viết để luyện lại sau |
| `POST /api/speaking-conversation/sessions/self` | Học viên tự chọn ngữ cảnh hội thoại (không cần `SpeakingTopic` do giáo viên tạo trước) |
| `GET /api/auth/teachers` | Danh sách giáo viên (cho dropdown "Chọn Giáo Viên Phụ Trách" lúc học viên tự do đăng ký) |
| `PUT /api/auth/change-password` | Đổi mật khẩu (yêu cầu đúng mật khẩu hiện tại, hash bằng bcrypt) |
| `GET /api/free-students/teacher/:teacherId` | Danh sách học viên tự do do 1 giáo viên phụ trách, kèm trạng thái dùng thử/hoạt động/khóa |
| `POST /api/free-students/confirm-payment` | Giáo viên xác nhận học viên tự do đã đóng phí — gia hạn quyền dùng thêm 1 tháng kể từ lúc xác nhận |
| `GET /api/free-students/payments/:studentId` | Lịch sử thanh toán của 1 học viên tự do (dùng ở tab Cài Đặt phía học viên) |
| `POST /api/srs/vocab/custom` · `GET/DELETE .../vocab/custom/:id` | Học viên tự thêm/xem/xóa từ vựng của riêng mình (không cần giáo viên soạn `Lesson`) |
| `GET /api/pronunciation/practice-set/:userId` | Từ/câu mẫu để luyện phát âm, lấy từ deck SRS của học viên |
| `POST /api/pronunciation/transcribe` | Ghi âm → text qua Groq Whisper (đồng bộ, không lưu Supabase Storage) |
| `POST /api/pronunciation/coach` | AI góp ý lỗi phát âm dựa trên so khớp transcript |
| `POST /api/pronunciation/attempts` · `GET .../attempts/:userId` | Lưu/xem lịch sử luyện phát âm |
| `POST /api/mock-test/generate` | AI sinh đề thi thử THPT Quốc Gia (2 lời gọi Groq song song: câu rời rạc + phần cần đoạn văn) |
| `POST /api/mock-test/analysis` | AI phân tích kết quả đề thi thử theo từng phần |
| `POST /api/mock-test/attempts` · `GET/PATCH .../attempts/:id`/`:userId` | Lưu/xem lịch sử đề thi thử |
| `GET /api/blog/posts` (`?category=&author=&tag=&q=&page=`) · `GET .../posts/:slug` · `GET .../categories` · `GET .../sitemap` | Blog công khai (chỉ bài đã đăng & đến giờ đăng) |
| `POST /api/admin/login` · `GET /api/admin/me` · `PUT /api/admin/change-password` · `GET /api/admin/overview` | Trang quản trị: đăng nhập (chỉ tài khoản role ADMIN), đổi mật khẩu admin, tổng quan hệ thống |
| `GET /api/admin/finance/summary?year=` · `GET/POST /api/admin/finance/transactions` · `PUT/DELETE .../transactions/:id` · `GET .../finance/categories` · `POST .../finance/copy-recurring` | Sổ thu chi nhập tay + lợi nhuận theo tháng |
| `GET /api/admin/users` · `POST /api/admin/users/teacher` · `POST /api/admin/users/:id/reset-password` | Quản lý tài khoản (tạo giáo viên, đặt lại mật khẩu mặc định) |
| `GET /api/blog/authors/:slug` · `.../authors/:slug/avatar` | Hồ sơ tác giả, avatar dạng ảnh |
| `/api/blog/manage/*` (`me`, `posts`, `posts/:id/revisions`, `revisions/:id`, `categories`, `slug-check`, `upload-image`, `author-profile`, `ai-suggest`, `post-picker`) | Quản lý blog — yêu cầu `userId` của tài khoản TEACHER; phân quyền admin theo `BLOG_ADMIN_EMAILS` |

**ORM:** Prisma 6 · **DB:** PostgreSQL (Supabase) — dùng chung 1 database cho cả dev và prod (kết nối qua `DATABASE_URL` trong `backend/.env`); file `backend/prisma/dev.db` là SQLite còn sót lại, không được dùng. Vì không có lịch sử `prisma migrate`, mọi thay đổi schema phải chạy `npx prisma db push` (không dùng `prisma migrate dev`, lệnh này sẽ đòi reset toàn bộ database do thiếu migration history)

---

## Lưu ý kỹ thuật quan trọng

- **Model AI (Groq) khai báo DUY NHẤT ở [backend/src/lib/aiModel.js](backend/src/lib/aiModel.js)** (`GROQ_TEXT_MODEL`, mặc định `openai/gpt-oss-120b`, override bằng biến môi trường `GROQ_TEXT_MODEL`). Không hardcode tên model trong route. Lý do: Groq đã gỡ `llama-3.3-70b-versatile` mà không báo trước, khiến toàn bộ tính năng AI chữ (18 chỗ) lỗi `model_not_found` cùng lúc. Danh sách model khả dụng: `groq.models.list()`. `whisper-large-v3` (chuyển giọng nói) vẫn còn.
- **Hiệu năng DB — mỗi truy vấn tốn ~340ms** (đo thực tế: Supabase Singapore qua pgbouncer, kết nối đầu ~1.5s). Độ trễ API gần như tỉ lệ thuận với **số truy vấn chạy nối tiếp**, nên: không `await prisma...` trong vòng lặp (dùng `createMany`/`updateMany`/`findMany({ where: { id: { in } } })`/`groupBy`), các truy vấn độc lập phải `Promise.all`, list endpoint chỉ `select` field cần hiển thị. Từng có nút "Hoàn thành" bài học mất >10s chỉ vì vòng lặp `findUnique`+`create` từng từ vựng.
- **Chỉ dùng 1 PrismaClient chung**: `require('../lib/prisma')` ([backend/src/lib/prisma.js](backend/src/lib/prisma.js)) — không `new PrismaClient()` trong file route (trước đây 23 instance = 23 pool kết nối riêng). Client này cấu hình `omit: { user: { password: true } }` nên **mọi truy vấn User mặc định không trả hash mật khẩu**; chỗ cần so khớp mật khẩu phải tự bật lại (`omit: { password: false }` như `signin`, hoặc `select: { password: true }` như `change-password`). Server gọi `$connect()` ngay lúc khởi động để người dùng đầu tiên không chịu cold connect.
- **Chuyển trang**: mọi route chính có `loading.tsx` (skeleton tĩnh từ [frontend/src/components/RouteSkeleton.tsx](frontend/src/components/RouteSkeleton.tsx)) để hiện ngay khi bấm link. Điều hướng nội bộ dùng `<Link>`/`router.push`/`router.replace`, không dùng `window.location.href` (tải lại toàn bộ trang). Thư viện nặng (FullCalendar, Recharts ở dashboard giáo viên, jspdf/html-to-image/xlsx/jszip/docx, canvas-confetti) phải load lười qua `next/dynamic` hoặc `await import()` trong handler — xem `CalendarComponent` (wrapper dynamic của `CalendarView`), `teacher/_components/OverviewCharts.tsx`, `lib/pdfExport.ts`
- **Next.js 16 có breaking changes** so với v13/14 — đọc `frontend/AGENTS.md` trước khi sửa cấu hình Next
- `ReactQuill` dùng dynamic import (`ssr: false`) vì không tương thích SSR
- Avatar lưu dạng base64 string trong DB — không dùng file upload server. **Luôn nén qua [frontend/src/lib/imageCompress.ts](frontend/src/lib/imageCompress.ts) (`compressImageToBase64`, Canvas resize tối đa 256px + JPEG q=0.85) trước khi lưu** — ảnh gốc chưa nén (phone photo) có thể vài–chục MB, từng khiến 1 avatar phình payload của mọi API trả về kèm avatar lên hàng chục MB. **Backend cũng tự nén lại** mọi avatar gửi tới `PUT /api/auth/avatar/:id` ([backend/src/utils/avatarCompress.js](backend/src/utils/avatarCompress.js), thư viện `jimp` thuần JS — không dùng `sharp` vì cần binary native khi deploy; cùng chuẩn 256px/JPEG 85/nền trắng; ảnh ≤60KB và ≤256px giữ nguyên). **Sự cố 10/2026**: 2 avatar cũ 15MB + 9MB (upload trước khi có bước nén) bị trả kèm ở `/api/auth/me` và danh sách lớp — dashboard tự gọi lại mỗi 30s — đẩy egress Supabase lên 7.9GB/5GB gói Free, **khoá toàn bộ Storage (lỗi 402)**. Đã nén lại bằng `node backend/scripts/compressExistingAvatars.js` (idempotent, sao lưu ảnh gốc vào `backend/backups/` — thư mục đã gitignore, chứa ảnh cá nhân)
- Khi viết `include`/`select` lồng nhau trả về `user` (vd kết quả bài thi, điểm danh...), **không bao giờ lồng `avatar` vào quan hệ có thể lặp nhiều dòng cho cùng 1 user** (vd `exam.results[].user.avatar`) — mỗi dòng lặp lại sẽ nhân bản nguyên chuỗi base64, từng khiến `GET /api/classroom/teacher/:teacherId` phình từ vài KB thực tế lên 15MB chỉ với 10 user. Nếu cần avatar để hiển thị, lấy từ danh sách `students`/`user` ở cấp cao nhất đã có sẵn, đừng lấy lại qua quan hệ lồng sâu
- Tất cả modal/alert dùng **SweetAlert2** (`Swal.fire()`), không dùng `window.alert`/`window.confirm`
- HTML từ ReactQuill phải được sanitize bằng `DOMPurify.sanitize()` trước khi render
- **Backend có route `POST /api/upload/exam`** (parse Word qua `mammoth`, PDF qua `pdf-parse`, tách câu bằng regex "Câu X:") nhưng **không có giao diện nào gọi tới** — route này hiện chưa được dùng. Cách nhập đề hàng loạt đang hoạt động thật là **Excel** ở tab CREATE (xem phần `/teacher` phía trên)
- **`react-quill-new` có bug: một ReactQuill mới mount lần đầu với `value` không rỗng, trong khi các ReactQuill khác đã tồn tại sẵn trên trang, có thể gây "Maximum update depth exceeded"** (React error #185) hoặc đồng bộ sai nội dung. Cách né trong `teacher/page.tsx`:
  - Toàn bộ danh sách câu hỏi (tab CREATE) được mount lại một lượt bằng cách đổi `key={questionsListGeneration}` mỗi khi nạp dữ liệu hàng loạt (import Excel, nhân bản đề) — giống cách tab CREATE vốn đã mount ổn định khi chuyển tab
  - Sau lần mount đầu tiên, việc thu gọn/mở rộng câu hỏi dùng **CSS ẩn (`hidden`) chứ không unmount/remount** (`everExpandedQuestions` theo dõi câu nào đã từng mở) — tránh mount lại ReactQuill nhiều lần
  - Khi cần tạo object câu hỏi mới, luôn gọi `BLANK_QUESTION()` hoặc `newQuestionKey()` để có `_key` duy nhất; thiếu `_key` sẽ làm nhiều card share chung 1 React key
- **`npx prisma db push`/`generate` có thể bị treo** vì 1 connection cũ ở trạng thái "idle in transaction" giữ lock trên bảng đang sửa (Supabase không tự dọn). Nếu gặp lỗi `statement timeout` hoặc `EPERM`/file bị khoá khi generate, kiểm tra `pg_stat_activity` (query trực tiếp qua Prisma `$queryRawUnsafe`, không có sẵn psql) để tìm session treo lâu rồi `pg_terminate_backend(pid)` — không phải lỗi do schema. `generate` cũng có thể bị khoá bởi chính `nodemon` đang chạy `backend/src/server.js` (giữ file `query_engine-windows.dll.node`) — cần dừng dev server trước khi generate lại trên Windows.
- **Responsive/mobile**: mọi header dạng `flex items-center justify-between` chứa tiêu đề + control phải có `flex-wrap` (hoặc `flex-col sm:flex-row`) — pattern này từng thiếu ở nhiều trang gây tràn ngang trên màn hình 360-400px. Nút bấm phụ (xuất PDF, "Nghe Mẫu", icon-only...) nên tối thiểu ~36-40px vùng chạm (`py-2` trở lên, hoặc bọc icon nhỏ trong `w-9 h-9` flex-center) — dùng padding `py-1.5` trở xuống cho nút bấm thật (không phải badge tĩnh) là dấu hiệu cần sửa. `sticky`/`max-height` cố định trong `style` (không qua class Tailwind) rất dễ áp dụng nhầm cả trên mobile dù layout chỉ `flex-col lg:flex-row` — luôn gate sticky/max-height bằng prefix `lg:` khi layout đổi từ dọc (mobile) sang ngang (desktop) ở cùng 1 breakpoint. FullCalendar không tự responsive — phải tự đổi `initialView`/`headerToolbar` theo `window.matchMedia` (xem `CalendarComponent`).
