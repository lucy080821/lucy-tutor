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

### Font mặc định

**Calibri** là font duy nhất của toàn app. Được set tại `globals.css` trên cả `html`, `body` và `*, *::before, *::after { font-family: inherit }` để override Tailwind preflight. Không import Google Fonts hay font nào khác.

---

## Các trang (App Router)

### `/` — Trang chủ

**File:** [frontend/src/app/page.tsx](frontend/src/app/page.tsx)

Trang landing page. Hai nút CTA:
- "Dành cho Học Sinh" → `/auth?role=STUDENT`
- "Dành cho Giáo Viên" → `/auth?role=TEACHER`

Hiển thị 6 feature card: Mục tiêu & Lộ trình, Sổ Tay Lỗi Sai, Cấp Bậc & EXP, AI Phân Tích, Quản Lý Lớp, Giao Diện Cá Nhân.

---

### `/auth` — Đăng nhập / Đăng ký

**File:** [frontend/src/app/auth/page.tsx](frontend/src/app/auth/page.tsx)

- Query param `?role=STUDENT|TEACHER` chọn vai trò mặc định
- Form toggle giữa **đăng nhập** và **đăng ký**
- "Nhớ tôi" lưu `userId` vào `localStorage` (mặc định bật), ngược lại dùng `sessionStorage`
- Sau đăng nhập: TEACHER → `/teacher`, STUDENT → `/dashboard`

---

### `/dashboard` — Dashboard Học sinh

**File:** [frontend/src/app/dashboard/page.tsx](frontend/src/app/dashboard/page.tsx)

Tabs chính:
- **OVERVIEW** — Tổng quan: XP, streak, cấp bậc, biểu đồ điểm (LineChart), tiến độ mục tiêu
- **EXAMS** — Danh sách đề thi được giao, nút làm bài
- **LESSONS** — Bài học từ lớp đã tham gia. Nếu học sinh tham gia từ 2 lớp trở lên, hiện dropdown lọc theo lớp (`lessonClassFilter`)
- **MISTAKES** — Sổ tay lỗi sai
- **LEADERBOARD** — Bảng xếp hạng lớp
- **CALENDAR** — Lịch học (FullCalendar)

Tính năng nổi bật:
- Upload avatar (base64, tối đa 100MB)
- Tham gia lớp bằng mã join code
- Hiển thị confetti khi đạt mốc XP
- Nút **"Cài Đặt Ứng Dụng"** (`InstallPWAButton`) ở header — cài app lên điện thoại qua PWA (`beforeinstallprompt` trên Android/Desktop, hướng dẫn thủ công cho iOS Safari)

---

### `/teacher` — Dashboard Giáo viên

**File:** [frontend/src/app/teacher/page.tsx](frontend/src/app/teacher/page.tsx)

Tabs chính:
- **OVERVIEW** — Thống kê lớp, biểu đồ điểm trung bình (BarChart), và **Quản Lý Thu Học Phí**: tổng hợp học phí của TẤT CẢ lớp theo tháng (tổng đã thu, tổng cần thu, số học sinh đã đóng/chưa đóng, bảng chi tiết lọc "Tất cả" / "Chỉ chưa đóng")
- **CLASSROOMS** — Quản lý lớp học (tạo/sửa/xóa), xem danh sách học sinh. Nút xóa lớp (`ClassCard` → `onDelete`) hiện khi hover, xác nhận qua SweetAlert2; xóa cascade toàn bộ bài học/đề thi/tài liệu/điểm danh/học phí của lớp đó
- **EXAMS** — Tạo đề thi, giao đề, import từ Word/PDF
- **QUESTIONS** — Ngân hàng câu hỏi
- **LESSONS** — Tạo bài học (editor ReactQuill). Có dropdown lọc bài học theo lớp (`lessonClassFilter`) ở đầu danh sách
- **DOCUMENTS** — Tài liệu đính kèm. Hỗ trợ định dạng PDF, Word (.doc/.docx) và **PowerPoint (.ppt/.pptx)**
- **ATTENDANCE** — Điểm danh học sinh
- **TUITION** — Học phí theo từng lớp (xuất hóa đơn PDF/Excel)
- **CALENDAR** — Lịch lên lớp (FullCalendar)
- **ANALYTICS** — Phân tích điểm yếu học sinh theo chuyên đề

Tính năng nổi bật:
- Rich text editor (ReactQuill) soạn câu hỏi với toolbar bold/italic/color
- Import đề từ file Word (mammoth) hoặc PDF (pdf-parse) qua backend
- Xuất báo cáo Excel (xlsx-js-style) và PDF (jsPDF)
- Xuất hóa đơn học phí qua component `TuitionInvoice`
- Mobile: hamburger menu (`isMobileMenuOpen`)

---

### `/exam/[id]` — Làm bài thi thật

**File:** [frontend/src/app/exam/[id]/page.tsx](frontend/src/app/exam/[id]/page.tsx)

- Load đề thi theo `id` từ API
- Giao diện làm bài trắc nghiệm + tự luận (essay)
- Theo dõi gian lận: mất focus tab, copy/paste, chụp màn hình → gửi lên `POST /api/exams/cheat`
- Nộp bài → `POST /api/exams/:id/submit` với `userId` từ storage
- Sau nộp: hiển thị kết quả, điểm, giải thích từng câu

### `/exam` — Demo làm bài (mock)

**File:** [frontend/src/app/exam/page.tsx](frontend/src/app/exam/page.tsx)

Trang demo với 1 câu hỏi mẫu. Hai chế độ: **Practice** (feedback ngay) và **Exam** (nộp xong mới feedback). Khi sai hiển thị `AskAIButton`.

---

### `/grammar-gym` và `/gym` — Luyện tập ngữ pháp

**Files:** [frontend/src/app/grammar-gym/page.tsx](frontend/src/app/grammar-gym/page.tsx), [frontend/src/app/gym/page.tsx](frontend/src/app/gym/page.tsx)

Module luyện tập ngữ pháp theo chuyên đề, tích hợp SRS (Spaced Repetition System).

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

---

## Auth & Session

- Không dùng NextAuth — tự quản lý bằng `userId` trong `localStorage` / `sessionStorage`
- `localStorage`: nhớ đăng nhập lâu dài ("Nhớ tôi")
- `sessionStorage`: chỉ nhớ trong tab hiện tại
- Mỗi trang dashboard tự fetch `/api/auth/me?userId=...` khi mount để lấy thông tin user đầy đủ

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
| `DELETE /api/classroom/:id` | Xóa lớp học (cascade xóa bài học/đề thi/tài liệu/điểm danh/học phí liên quan) |
| `GET /api/documents` | Danh sách tài liệu (`?classroomId=`, `?teacherId=`). Upload chấp nhận `.pdf`, `.doc`, `.docx`, `.ppt`, `.pptx` |
| `GET /api/attendance/report/:classroomId` | Báo cáo học phí theo tháng của 1 lớp |
| `GET /api/attendance/report/teacher/:teacherId` | Báo cáo học phí tổng hợp TẤT CẢ lớp của giáo viên theo tháng (tổng đã thu, tổng cần thu, danh sách đã đóng/chưa đóng) — dùng cho tab OVERVIEW |
| `GET /api/analytics/...` | Thống kê học tập |
| `POST /api/ai/...` | AI feedback (Groq) |

**ORM:** Prisma 6 · **DB:** PostgreSQL (prod) / SQLite (dev)

---

## Lưu ý kỹ thuật quan trọng

- **Next.js 16 có breaking changes** so với v13/14 — đọc `frontend/AGENTS.md` trước khi sửa cấu hình Next
- `ReactQuill` dùng dynamic import (`ssr: false`) vì không tương thích SSR
- Avatar lưu dạng base64 string trong DB — không dùng file upload server
- Tất cả modal/alert dùng **SweetAlert2** (`Swal.fire()`), không dùng `window.alert`/`window.confirm`
- HTML từ ReactQuill phải được sanitize bằng `DOMPurify.sanitize()` trước khi render
