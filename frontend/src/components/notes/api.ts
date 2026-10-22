// Gọi API Lucy Notes (/api/notes, /api/notes-ai). Đã đăng nhập: userId lấy từ phiên (lib/session.ts), dữ liệu trên máy chủ.
// Chưa đăng nhập (khách): Ghi chú vẫn dùng miễn phí — /api/notes/* được giả lập trên trình duyệt (localStore.ts, IndexedDB),
// còn AI gọi máy chủ không kèm userId (hạn mức khách theo IP) và gửi kèm nội dung trang vì trang không nằm trên máy chủ.
import { getSessionUserId } from "@/lib/session";
import {
  LocalError, localNotesApi, localPageForAi, localAskPages, localLinkCandidates, localTriageInput, localTriageApply,
  localStudyReview, localDigest, saveLocalAudio,
} from "./localStore";

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

/** Chưa đăng nhập → chế độ khách (ghi chú lưu trên trình duyệt) */
export const isGuest = () => !getSessionUserId();

async function request<T>(base: "notes" | "notes-ai", path: string, opts: Opts = {}): Promise<T> {
  const userId = getSessionUserId() || "";
  const method = opts.method || (opts.body || opts.form ? "POST" : "GET");
  let url = `${API_URL}/api/${base}${path}`;
  let body: BodyInit | undefined;
  const headers: Record<string, string> = {};
  if (method === "GET" || method === "DELETE") {
    if (userId) url += `${path.includes("?") ? "&" : "?"}userId=${encodeURIComponent(userId)}`;
  } else if (opts.form) {
    if (userId) opts.form.set("userId", userId);
    body = opts.form;
  } else {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify({ ...(opts.body as object || {}), ...(userId ? { userId } : {}) });
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

async function local<T>(fn: () => Promise<T>): Promise<T> {
  try { return await fn(); }
  catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof LocalError) throw new ApiError(err.message, err.status, err.data);
    throw new ApiError((err as Error)?.message || "Không lưu được trên trình duyệt", 0, null);
  }
}

export const notesApi = <T = any>(path: string, opts: Opts = {}): Promise<T> => {
  if (!isGuest()) return request<T>("notes", path, opts);
  const method = opts.method || (opts.body || opts.form ? "POST" : "GET");
  return local(async () => {
    const data = await localNotesApi(path, method, opts.body || {}, opts.form);
    // bootstrap của khách: lấy hạn mức AI khách từ máy chủ (theo IP)
    if (path.startsWith("/bootstrap") && data && !data.usage) {
      data.usage = await request("notes-ai", "/usage").catch(() => ({ TEXT: { used: 0, limit: 10, left: 10 }, AUDIO: { used: 0, limit: 1, left: 1 } }));
    }
    return data as T;
  });
};

export const aiApi = async <T = any>(path: string, opts: Opts = {}): Promise<T> => {
  if (!isGuest()) return request<T>("notes-ai", path, opts);
  const body = { ...((opts.body as Record<string, any>) || {}) };
  return local(async () => {
    // Phần không cần AI hoặc cần tài khoản: xử lý ngay trên máy
    const study = /^\/study\/([^/]+)\/review/.exec(path);
    if (study) return (await localStudyReview(study[1], body.grade)) as T;
    if (path === "/triage/apply") return (await localTriageApply(body.items || [])) as T;
    if (path === "/digest") return (await localDigest()) as T;
    if (path === "/journal/profile") return { total: 0, categories: [], guest: true } as T;
    if (path === "/agent/history") return [] as T;
    // Gửi kèm nội dung trang trên máy (máy chủ không có trang của khách)
    if (body.pageId && path !== "/transcribe") {
      const pg = await localPageForAi(body.pageId);
      if (pg) { body.title = pg.title; if (!body.text) body.text = pg.text; body.doc = pg.doc; }
    }
    if (path === "/ask") body.pages = await localAskPages(String(body.question || ""), body.scope);
    if (path === "/suggest-links" && body.pageId) body.candidates = await localLinkCandidates(body.pageId);
    if (path === "/triage") Object.assign(body, await localTriageInput());
    if (path === "/transcribe" && opts.form) {
      // Ghi âm của khách: máy chủ chỉ chép lời (không lưu file); file giữ trên trình duyệt với id localId
      const localId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`;
      opts.form.set("localId", localId);
      const r: any = await request("notes-ai", path, opts);
      const audio = opts.form.get("audio") as Blob | null;
      if (audio) r.attachment = await saveLocalAudio(localId, (opts.form.get("pageId") as string) || null, audio, r.attachment?.name || "Ghi âm", r.transcript);
      return r as T;
    }
    return request<T>("notes-ai", path, { ...opts, body });
  });
};

export const errMsg = (err: unknown) => (err instanceof Error ? err.message : "Có lỗi xảy ra");
