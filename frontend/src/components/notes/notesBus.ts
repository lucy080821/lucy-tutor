// Kênh sự kiện nhỏ giữa danh sách trang (PageList) và trang đang mở (PageView): danh sách ghim/chuyển/lưu trữ 1 trang
// đang mở thì trang cập nhật theo; đổi tên/xoá trang đang mở thì giao cho PageView làm (để không lệch version lưu tự động).
export type PageChange = { id: string; title?: string; pinned?: boolean; archivedAt?: string | null; sectionId?: string | null; parentId?: string | null };
export type PageCommand = { id: string; action: "rename" | "delete" };

const CHANGE = "lucy-notes-page-change";
const COMMAND = "lucy-notes-page-command";

export const emitPageChange = (d: PageChange) => window.dispatchEvent(new CustomEvent(CHANGE, { detail: d }));
export const emitPageCommand = (d: PageCommand) => window.dispatchEvent(new CustomEvent(COMMAND, { detail: d }));

export function onPageChange(cb: (d: PageChange) => void) {
  const h = (e: Event) => cb((e as CustomEvent).detail);
  window.addEventListener(CHANGE, h);
  return () => window.removeEventListener(CHANGE, h);
}
export function onPageCommand(cb: (d: PageCommand) => void) {
  const h = (e: Event) => cb((e as CustomEvent).detail);
  window.addEventListener(COMMAND, h);
  return () => window.removeEventListener(COMMAND, h);
}
