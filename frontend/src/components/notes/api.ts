// Gọi API Lucy Notes (/api/notes, /api/notes-ai). userId lấy từ phiên đăng nhập (lib/session.ts) giống mọi trang khác.
import { getSessionUserId } from "@/lib/session";

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export class ApiError extends Error {
  status: number;
  data: any;
  constructor(message: string, status: number, data: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

type Opts = { method?: string; body?: unknown; form?: FormData; signal?: AbortSignal; keepalive?: boolean };

async function request<T>(base: "notes" | "notes-ai", path: string, opts: Opts = {}): Promise<T> {
  const userId = getSessionUserId() || "";
  const method = opts.method || (opts.body || opts.form ? "POST" : "GET");
  let url = `${API_URL}/api/${base}${path}`;
  let body: BodyInit | undefined;
  const headers: Record<string, string> = {};
  if (method === "GET" || method === "DELETE") {
    url += `${path.includes("?") ? "&" : "?"}userId=${encodeURIComponent(userId)}`;
  } else if (opts.form) {
    opts.form.set("userId", userId);
    body = opts.form;
  } else {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify({ ...(opts.body as object || {}), userId });
  }
  let res: Response;
  try {
    res = await fetch(url, { method, headers, body, signal: opts.signal, keepalive: opts.keepalive });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ApiError("Mất kết nối tới máy chủ. Kiểm tra mạng rồi thử lại.", 0, null);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data?.error || `Lỗi ${res.status}`, res.status, data);
  return data as T;
}

export const notesApi = <T = any>(path: string, opts?: Opts) => request<T>("notes", path, opts);
export const aiApi = <T = any>(path: string, opts?: Opts) => request<T>("notes-ai", path, opts);
export const errMsg = (err: unknown) => (err instanceof Error ? err.message : "Có lỗi xảy ra");
