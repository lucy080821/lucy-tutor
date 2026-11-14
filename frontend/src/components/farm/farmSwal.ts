// SweetAlert2 cho Nông Trại: khi đang toàn màn hình (requestFullscreen trên #farm-root), hộp thoại gắn vào body
// sẽ nằm NGOÀI phần tử fullscreen và không hiện → luôn gắn vào phần tử đang fullscreen nếu có.
import Swal, { type SweetAlertOptions, type SweetAlertResult } from "sweetalert2";

export function fire<T = any>(opts: SweetAlertOptions): Promise<SweetAlertResult<T>> {
  const target = (typeof document !== "undefined" && (document.fullscreenElement as HTMLElement | null)) || "body";
  return Swal.fire({ ...opts, target }) as Promise<SweetAlertResult<T>>;
}
export const alert = (title: string, text: string, icon: "success" | "error" | "info" | "warning" | "question" = "info") => fire({ title, text, icon, confirmButtonColor: "#1E3A8A" });
export default fire;
