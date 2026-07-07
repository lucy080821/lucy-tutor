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

Tabs chính (điều hướng theo nhóm — xem `navGroups` trong file):
- **OVERVIEW** (Tổng Quan) — Dashboard "sức khỏe kinh doanh" của giáo viên:
  - 5 thẻ KPI đầu trang (`StatCard` với icon + màu nền theo `accent`): Tổng Lớp, Tổng Học Sinh, Bài Tập/Đề Thi, Câu Hỏi, **Tỷ Lệ Nộp Bài** (số học sinh đã nộp / tổng số bài đã giao, tính từ `classroom.exams[].results`)
  - **Doanh Thu Học Phí 6 Tháng Gần Đây** (BarChart) — gọi `GET /api/attendance/report/teacher/:teacherId` 6 lần (mỗi tháng 1 lần, `Promise.all`) để dựng biểu đồ Đã Thu vs Cần Thu theo tháng, không cần API mới
  - **Sĩ Số & Bài Tập Theo Lớp** (BarChart nhóm cột) — so sánh số học sinh và số bài tập giữa các lớp
  - **Tình Hình Thu Học Phí** (PieChart dạng donut) — Đã thu / Còn thiếu của tháng hiện tại (`overviewTuitionMonth`), có nhãn % ở giữa vòng tròn
  - **Điểm Trung Bình Theo Lớp** (BarChart ngang, xếp hạng) — điểm trung bình cao nhất mỗi đề của học sinh, tính bằng `studentAvgScore`/`classroomScoreStats`
  - Không hiển thị lưới danh sách lớp học ở đây nữa (đã chuyển hẳn sang tab **CLASSES**, tránh trùng lặp)
  - Bên dưới vẫn còn **Quản Lý Thu Học Phí** (bảng chi tiết theo tháng, lọc "Tất cả" / "Chỉ chưa đóng")
- **CLASSES** (Lớp Học) — Quản lý lớp học (tạo/sửa/xóa), xem danh sách học sinh. Nút xóa lớp (`ClassCard` → `onDelete`) hiện khi hover, xác nhận qua SweetAlert2; xóa cascade toàn bộ bài học/đề thi/tài liệu/điểm danh/học phí của lớp đó
- **STUDENTS** (Học Sinh) — Danh sách toàn bộ học sinh, tìm kiếm theo tên/email, hiển thị cấp bậc/XP, điểm trung bình, tiến độ so với mục tiêu
- **ATTENDANCE** (Điểm Danh & Học Phí) — 2 view con: "Điểm Danh" (mark theo ngày) và "Báo Cáo Học Phí" (theo từng lớp, xuất hóa đơn PDF/Excel)
- **CHEAT_CONTROL** (Kiểm Soát Gian Lận) — xem log gian lận (mất focus tab, copy/paste) theo học sinh/đề thi
- **CALENDAR** (Thời Khóa Biểu) — Lịch lên lớp (FullCalendar)
- **LESSONS** (Danh Sách Bài Học) — danh sách bài học đã tạo, dropdown lọc theo lớp (`lessonClassFilter`)
- **CREATE_LESSON** (Tạo Bài Học) — soạn bài học (ReactQuill), nhập từ vựng hàng loạt qua Excel mẫu
- **DOCUMENTS** (Kho Tài Liệu) — Tài liệu đính kèm. Hỗ trợ định dạng PDF, Word (.doc/.docx) và **PowerPoint (.ppt/.pptx)**
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
- **Backend có route `POST /api/upload/exam`** (parse Word qua `mammoth`, PDF qua `pdf-parse`, tách câu bằng regex "Câu X:") nhưng **không có giao diện nào gọi tới** — route này hiện chưa được dùng. Cách nhập đề hàng loạt đang hoạt động thật là **Excel** ở tab CREATE (xem phần `/teacher` phía trên)
- **`react-quill-new` có bug: một ReactQuill mới mount lần đầu với `value` không rỗng, trong khi các ReactQuill khác đã tồn tại sẵn trên trang, có thể gây "Maximum update depth exceeded"** (React error #185) hoặc đồng bộ sai nội dung. Cách né trong `teacher/page.tsx`:
  - Toàn bộ danh sách câu hỏi (tab CREATE) được mount lại một lượt bằng cách đổi `key={questionsListGeneration}` mỗi khi nạp dữ liệu hàng loạt (import Excel, nhân bản đề) — giống cách tab CREATE vốn đã mount ổn định khi chuyển tab
  - Sau lần mount đầu tiên, việc thu gọn/mở rộng câu hỏi dùng **CSS ẩn (`hidden`) chứ không unmount/remount** (`everExpandedQuestions` theo dõi câu nào đã từng mở) — tránh mount lại ReactQuill nhiều lần
  - Khi cần tạo object câu hỏi mới, luôn gọi `BLANK_QUESTION()` hoặc `newQuestionKey()` để có `_key` duy nhất; thiếu `_key` sẽ làm nhiều card share chung 1 React key
