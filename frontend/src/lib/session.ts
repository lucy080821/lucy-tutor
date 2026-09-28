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

export function clearSession() {
  if (typeof window === "undefined") return;
  safeRemove(localStorage, KEY);
  safeRemove(sessionStorage, KEY);
  // Dữ liệu cá nhân hoá theo người dùng trước — không để lọt sang tài khoản sau
  safeRemove(localStorage, "lucy_previous_xp");
}
