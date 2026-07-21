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

Hiển thị 8 feature card (`FEATURES`): AI Phân Tích Điểm Yếu, Luyện Phát Âm Cùng AI, Đề Thi Thử THPT Quốc Gia, Biểu Đồ Tiến Độ 4 Kỹ Năng, SRS Vocabulary, Ngân Hàng Câu Hỏi, Gamification & Streak, Dashboard Giáo Viên Pro.

**Không dùng số liệu/testimonial dàn dựng**: trang từng có khối thống kê ảo ("2,400+ học viên", "94% tăng điểm"...) và 3 testimonial hư cấu kèm tên/điểm số cụ thể — đã bỏ hẳn vì app chưa có người dùng thật. Thay vào đó hero hiển thị callout thật: "🎁 Dùng thử miễn phí 3 ngày · Không cần thẻ tín dụng" (khớp với hệ thống dùng thử thật ở mục "Học viên tự do" bên dưới). Badge hero cũng đổi từ "#1 VIỆT NAM" (không có căn cứ) sang "NỀN TẢNG LUYỆN THI TIẾNG ANH TOÀN DIỆN". Nguyên tắc: **không thêm số liệu/lời chứng thực nào chưa được xác thực** vào trang này.

---

### `/auth` — Đăng nhập / Đăng ký

**File:** [frontend/src/app/auth/page.tsx](frontend/src/app/auth/page.tsx)

- Query param `?role=STUDENT|TEACHER` chọn vai trò mặc định
- Form toggle giữa **đăng nhập** và **đăng ký**
- "Nhớ tôi" lưu `userId` vào `localStorage` (mặc định bật), ngược lại dùng `sessionStorage`
- Sau đăng nhập: TEACHER → `/teacher`, STUDENT → `/dashboard` — điều hướng dựa theo `role` **thật sự trả về từ server** (`data.role`), không phải toggle vai trò người dùng tự chọn trên UI
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
  - **💡 Insights & Khuyến Nghị Kinh Doanh** — panel `InsightCard` tự động sinh nhận định (rule-based, không gọi AI) từ dữ liệu đang có trên dashboard: tăng/giảm doanh thu theo tháng, tốc độ thu học phí, tỷ lệ nộp bài, lớp có điểm TB thấp/cao nhất, lớp có tỷ lệ chưa đóng học phí cao, lớp sĩ số quá nhỏ (cơ hội tuyển sinh), học viên học dưới mục tiêu điểm số. Mỗi insight có `level` (critical/warning/success/info) quyết định màu và được sắp xếp mức độ nghiêm trọng giảm dần, tối đa 6 thẻ. Logic nằm ngay trong `TeacherDashboard` (biến `businessInsights`), không có API riêng
  - **Tự động làm mới (near real-time)**: trong lúc đang ở tab OVERVIEW, `overviewRefreshTick` tăng mỗi 30 giây (`setInterval`) và mỗi khi tab trình duyệt lấy lại focus (`visibilitychange`), kéo theo refetch `classrooms` + báo cáo học phí + doanh thu 6 tháng → toàn bộ KPI/insight tính lại theo dữ liệu mới nhất mà không cần bấm F5. Không dùng WebSocket/push — đây là polling phía client, giữ đúng kiến trúc REST hiện có của dự án
  - **Doanh Thu Học Phí 6 Tháng Gần Đây** (BarChart) — gọi `GET /api/attendance/report/teacher/:teacherId` 6 lần (mỗi tháng 1 lần, `Promise.all`) để dựng biểu đồ Đã Thu vs Cần Thu theo tháng, không cần API mới
  - **Sĩ Số & Bài Tập Theo Lớp** (BarChart nhóm cột) — so sánh số học sinh và số bài tập giữa các lớp
  - **Tình Hình Thu Học Phí** (PieChart dạng donut) — Đã thu / Còn thiếu của tháng hiện tại (`overviewTuitionMonth`), có nhãn % ở giữa vòng tròn
  - **Điểm Trung Bình Theo Lớp** (BarChart ngang, xếp hạng) — điểm trung bình cao nhất mỗi đề của học sinh, tính bằng `studentAvgScore`/`classroomScoreStats`
  - Không hiển thị lưới danh sách lớp học ở đây nữa (đã chuyển hẳn sang tab **CLASSES**, tránh trùng lặp)
  - Bên dưới vẫn còn **Quản Lý Thu Học Phí** (bảng chi tiết theo tháng, lọc "Tất cả" / "Chỉ chưa đóng")
- **CLASSES** (Lớp Học) — Quản lý lớp học (tạo/sửa/xóa), xem danh sách học sinh. Nút xóa lớp (`ClassCard` → `onDelete`) hiện khi hover, xác nhận qua SweetAlert2; xóa cascade toàn bộ bài học/đề thi/tài liệu/điểm danh/học phí của lớp đó
- **STUDENTS** (Học Sinh) — Danh sách toàn bộ học sinh, tìm kiếm theo tên/email, hiển thị cấp bậc/XP, điểm trung bình, tiến độ so với mục tiêu
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

**ORM:** Prisma 6 · **DB:** PostgreSQL (Supabase) — dùng chung 1 database cho cả dev và prod (kết nối qua `DATABASE_URL` trong `backend/.env`); file `backend/prisma/dev.db` là SQLite còn sót lại, không được dùng. Vì không có lịch sử `prisma migrate`, mọi thay đổi schema phải chạy `npx prisma db push` (không dùng `prisma migrate dev`, lệnh này sẽ đòi reset toàn bộ database do thiếu migration history)

---

## Lưu ý kỹ thuật quan trọng

- **Next.js 16 có breaking changes** so với v13/14 — đọc `frontend/AGENTS.md` trước khi sửa cấu hình Next
- `ReactQuill` dùng dynamic import (`ssr: false`) vì không tương thích SSR
- Avatar lưu dạng base64 string trong DB — không dùng file upload server. **Luôn nén qua [frontend/src/lib/imageCompress.ts](frontend/src/lib/imageCompress.ts) (`compressImageToBase64`, Canvas resize tối đa 256px + JPEG q=0.85) trước khi lưu** — ảnh gốc chưa nén (phone photo) có thể vài–chục MB, từng khiến 1 avatar phình payload của mọi API trả về kèm avatar lên hàng chục MB. Backend **không có** thư viện xử lý ảnh (sharp/ImageMagick) nên không thể tự nén lại ảnh cũ — phải nén ở client lúc upload
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
