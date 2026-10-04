// Nguồn duy nhất để đọc/ghi phiên đăng nhập (userId) phía client.
//
// Trước đây mỗi trang tự đọc `localStorage || sessionStorage` còn lúc đăng nhập chỉ ghi vào 1 nơi
// mà không xoá nơi kia → trên máy/trình duyệt dùng chung, userId "Nhớ tôi" của người trước còn sót
// trong localStorage luôn thắng phiên mới của người sau (học viên A mở app lại thấy tài khoản học viên B).
// Quy tắc bây giờ: đăng nhập/đăng xuất luôn dọn cả 2 nơi; nếu cả 2 nơi cùng có mà khác nhau
// (dữ liệu cũ từ trước bản sửa) thì coi như phiên hỏng → xoá hết, bắt đăng nhập lại.

const KEY = "userId";

function safeGet(storage: Storage, key: string): string | null {
  try { return storage.getItem(key); } catch { return null; }
}

function safeRemove(storage: Storage, key: string) {
  try { storage.removeItem(key); } catch { /* storage bị chặn — bỏ qua */ }
}

export function getSessionUserId(): string | null {
  if (typeof window === "undefined") return null;
  const local = safeGet(localStorage, KEY);
  const session = safeGet(sessionStorage, KEY);
  if (local && session && local !== session) {
    clearSession();
    return null;
  }
  return session || local;
}

export function setSessionUserId(userId: string, remember: boolean) {
  clearSession();
  try {
    (remember ? localStorage : sessionStorage).setItem(KEY, userId);
  } catch { /* storage bị chặn — phiên chỉ tồn tại tới khi tải lại trang */ }
}

// 3 loại tài khoản tách biệt hoàn toàn, mỗi loại chỉ vào đúng khu vực của mình:
// STUDENT -> /dashboard, TEACHER -> /teacher, ADMIN -> chỉ /administrator (đăng nhập riêng, không dùng phiên userId này).
// Role khác 2 role trên (ADMIN, hoặc dữ liệu lạ) không có chỗ trong luồng userId -> null.
export function homeForRole(role: string | null | undefined): "/dashboard" | "/teacher" | null {
  return role === "STUDENT" ? "/dashboard" : role === "TEACHER" ? "/teacher" : null;
}

// Gọi khi trang phát hiện tài khoản không thuộc khu vực này: chuyển về đúng khu vực của tài khoản,
// hoặc (tài khoản không được dùng luồng này, vd ADMIN) xoá phiên và quay về trang đăng nhập.
export function redirectToOwnArea(role: string | null | undefined, router: { replace: (href: string) => void }) {
  const home = homeForRole(role);
  if (home) { router.replace(home); return; }
  clearSession();
  router.replace("/auth");
}

export function clearSession() {
  if (typeof window === "undefined") return;
  safeRemove(localStorage, KEY);
  safeRemove(sessionStorage, KEY);
  // Dữ liệu cá nhân hoá theo người dùng trước — không để lọt sang tài khoản sau
  safeRemove(localStorage, "lucy_previous_xp");
}
