// Chế độ khách (chưa đăng nhập): Ghi chú dùng miễn phí, dữ liệu lưu trên trình duyệt (IndexedDB "lucy-notes-guest").
// File này giả lập đúng các endpoint /api/notes/* mà giao diện gọi (cùng hình dạng dữ liệu với backend thật) nên
// các component không cần biết đang ở chế độ nào — xem api.ts. Ảnh lưu dạng data URL trong nội dung trang, ghi âm lưu
// dạng Blob. Đăng nhập xong có thể đưa toàn bộ lên tài khoản (migrateGuestNotes).
import type { JSONContent } from "@tiptap/react";

const DB_NAME = "lucy-notes-guest";
const STORES = ["notebooks", "sections", "pages", "revisions", "attachments", "templates"] as const;
type StoreName = (typeof STORES)[number];
type Row = Record<string, any> & { id: string };

let dbPromise: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("Trình duyệt không hỗ trợ lưu ghi chú (IndexedDB). Hãy đăng nhập để lưu trên tài khoản.")); return; }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { STORES.forEach((s) => { if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s, { keyPath: "id" }); }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("Không mở được bộ nhớ trình duyệt (có thể đang ở chế độ ẩn danh)."));
  });
  return dbPromise;
}
async function all<T = Row>(store: StoreName): Promise<T[]> {
  const d = await db();
  return new Promise((res, rej) => { const r = d.transaction(store).objectStore(store).getAll(); r.onsuccess = () => res(r.result as T[]); r.onerror = () => rej(r.error); });
}
async function get<T = Row>(store: StoreName, id: string): Promise<T | undefined> {
  const d = await db();
  return new Promise((res, rej) => { const r = d.transaction(store).objectStore(store).get(id); r.onsuccess = () => res(r.result as T); r.onerror = () => rej(r.error); });
}
async function put(store: StoreName, rows: Row | Row[]) {
  const d = await db();
  const list = Array.isArray(rows) ? rows : [rows];
  await new Promise<void>((res, rej) => { const tx = d.transaction(store, "readwrite"); list.forEach((x) => tx.objectStore(store).put(x)); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
}
async function del(store: StoreName, ids: string | string[]) {
  const d = await db();
  const list = Array.isArray(ids) ? ids : [ids];
  await new Promise<void>((res, rej) => { const tx = d.transaction(store, "readwrite"); list.forEach((x) => tx.objectStore(store).delete(x)); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
}

export class LocalError extends Error { status: number; data: any; constructor(m: string, status = 400, data: any = null) { super(m); this.status = status; this.data = data; } }
const fail = (status: number, msg: string, data: any = null): never => { throw new LocalError(msg, status, data); };
const needLogin = (what: string): never => fail(401, `${what} cần đăng nhập để nối với dữ liệu trong tài khoản Lucy Tutor. Ghi chú thường vẫn dùng miễn phí không cần đăng nhập.`);
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === "x" ? r : (r & 3) | 8).toString(16); }));
const now = () => new Date().toISOString();

// ── Xử lý tài liệu (bản chép của backend/src/utils/notesCore.js) ──
export const normalizeSearch = (s: string) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().replace(/\s+/g, " ").trim();
const BLOCKS = new Set(["paragraph", "heading", "codeBlock", "mindmap"]);
function nodeText(n: JSONContent): string {
  if (n.type === "text") return n.text || "";
  if (n.type === "hardBreak") return "\n";
  if (n.type === "mindmap") {
    const labels: string[] = [];
    const visit = (x: any) => { if (!x) return; labels.push(x.label || ""); (x.children || []).forEach(visit); };
    try { visit(JSON.parse(n.attrs?.data || "{}")); } catch { /* bỏ qua */ }
    return labels.filter(Boolean).join(" · ");
  }
  const inner = (n.content || []).map(nodeText);
  return n.type === "tableRow" ? inner.join(" | ") : inner.join("");
}
function walk(n: JSONContent | null | undefined, fn: (n: JSONContent, parents: JSONContent[]) => void, parents: JSONContent[] = []) {
  if (!n) return;
  fn(n, parents);
  (n.content || []).forEach((c) => walk(c, fn, [...parents, n]));
}
export function docBlocks(doc: JSONContent | null | undefined) {
  const out: string[] = [];
  walk(doc, (n, parents) => {
    if (n.type === "tableRow") { const t = nodeText(n).trim(); if (t) out.push(t); return; }
    if (!BLOCKS.has(n.type || "")) return;
    if (n.type === "paragraph" && parents.some((p) => p.type === "tableRow")) return;
    const t = nodeText(n).trim();
    if (t) out.push(t);
  });
  return out;
}
const plain = (doc: JSONContent | null) => docBlocks(doc).join("\n");
function tasksOf(doc: JSONContent | null) {
  const out: { tid: string; text: string; done: boolean; dueAt: string | null }[] = [];
  walk(doc, (n) => {
    if (n.type !== "taskItem" || !n.attrs?.tid) return;
    const text = (n.content || []).filter((c) => c.type === "paragraph").map(nodeText).join(" ").trim();
    out.push({ tid: n.attrs.tid, text: text || "(việc chưa đặt tên)", done: !!n.attrs.checked, dueAt: n.attrs.due || null });
  });
  return out;
}
function linkedIds(doc: JSONContent | null) {
  const ids = new Set<string>();
  walk(doc, (n) => (n.marks || []).forEach((m) => { const hit = m.type === "link" && /^\/notes\?p=([0-9a-f-]{36})/i.exec(String(m.attrs?.href || "")); if (hit) ids.add(hit[1]); }));
  return [...ids];
}
function derive(page: Row, extra = "") {
  const plainText = plain(page.contentJson);
  return {
    plainText,
    excerpt: plainText.replace(/\s+/g, " ").trim().slice(0, 200),
    wordCount: (plainText.match(/\S+/g) || []).length,
    linkedPageIds: linkedIds(page.contentJson),
    searchText: normalizeSearch(`${page.title}\n${plainText}\n${(page.tags || []).join(" ")}\n${extra}`),
  };
}
const cleanTags = (tags: unknown) => [...new Set((Array.isArray(tags) ? tags : []).map((t) => String(t).trim().replace(/^#/, "").toLowerCase().replace(/\s+/g, "-").slice(0, 40)).filter(Boolean))].slice(0, 20);
const LIST_KEYS = ["id", "title", "excerpt", "tags", "color", "pinned", "sectionId", "parentId", "order", "wordCount", "remindAt", "archivedAt", "deletedAt", "updatedAt", "createdAt", "template", "studyDueAt"];
const listItem = (p: Row) => Object.fromEntries(LIST_KEYS.map((k) => [k, p[k] ?? null]));

/** Cú pháp tìm kiếm giống server: từ khoá, "cụm từ", -loại-trừ, tag:x, co:anh|ghiam|file|viec, ghim */
function matcher(q: string, atts: Row[]) {
  const conds: ((p: Row) => boolean)[] = [];
  const re = /(-?)(?:(tag|co):)?(?:"([^"]+)"|(\S+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(String(q || "").slice(0, 300)))) {
    const neg = m[1] === "-"; const key = m[2]; const raw = (m[3] ?? m[4] ?? "").trim();
    if (!raw) continue;
    let c: ((p: Row) => boolean) | null = null;
    if (key === "tag") { const t = raw.replace(/^#/, "").toLowerCase(); c = (p) => (p.tags || []).includes(t); }
    else if (key === "co") {
      const k = normalizeSearch(raw);
      const kind = k === "anh" ? "IMAGE" : k === "ghiam" || k === "ghi-am" ? "AUDIO" : k === "file" ? "FILE" : null;
      if (kind) c = (p) => atts.some((a) => a.pageId === p.id && a.kind === kind) || (kind === "IMAGE" && JSON.stringify(p.contentJson || {}).includes('"type":"image"'));
      else if (k === "viec") c = (p) => tasksOf(p.contentJson).length > 0;
    } else if (normalizeSearch(raw) === "ghim" && !m[3]) c = (p) => !!p.pinned;
    else { const t = normalizeSearch(raw); c = (p) => String(p.searchText || "").includes(t); }
    if (c) { const f = c; conds.push(neg ? (p) => !f(p) : f); }
  }
  return (p: Row) => conds.every((f) => f(p));
}

async function pageAttachments(pageId: string) {
  return (await all("attachments")).filter((a) => a.pageId === pageId);
}
/** Tệp cho giao diện: ghi âm trả object URL tạo mới mỗi lần (Blob lưu trong IndexedDB) */
const urlCache = new Map<string, string>();
function attView(a: Row) {
  let url = a.url as string | null;
  if (a.blob) { url = urlCache.get(a.id) || URL.createObjectURL(a.blob); urlCache.set(a.id, url); }
  return { id: a.id, kind: a.kind, name: a.name, mime: a.mime, size: a.size, url, createdAt: a.createdAt, transcript: a.transcript || null };
}

async function descendants(rootId: string) {
  const pages = await all("pages");
  const ids = [rootId];
  let frontier = [rootId];
  for (let i = 0; i < 3 && frontier.length; i += 1) { frontier = pages.filter((p) => frontier.includes(p.parentId)).map((p) => p.id); ids.push(...frontier); }
  return ids;
}

async function savePage(page: Row) {
  const atts = await pageAttachments(page.id);
  const extra = atts.map((a) => `${a.name} ${a.ocrText || ""} ${(a.transcript || []).map((s: any) => s.text).join(" ")}`).join(" ");
  Object.assign(page, derive(page, extra));
  await put("pages", page);
}

// ── Router ──
const parseUrl = (path: string) => { const u = new URL(path, "http://local"); return { parts: u.pathname.split("/").filter(Boolean), q: Object.fromEntries(u.searchParams.entries()) }; };

export async function localNotesApi(path: string, method: string, body: any, form?: FormData): Promise<any> {
  const { parts, q } = parseUrl(path);
  const [a, b, c] = parts;
  const M = method.toUpperCase();

  if (a === "bootstrap") return bootstrap();
  if (a === "notebooks") {
    if (M === "POST" && b === "reorder") { await reorder("notebooks", body.ids); return { ok: true }; }
    if (M === "POST") {
      const list = await all("notebooks");
      const nb = { id: uuid(), name: String(body.name || "").trim().slice(0, 120) || "Sổ tay mới", color: body.color || "#1E3A8A", order: list.length, aiDisabled: false, createdAt: now() };
      const sec = { id: uuid(), notebookId: nb.id, name: "Mục chung", color: "#3b82f6", order: 0, createdAt: now() };
      await put("notebooks", nb); await put("sections", sec);
      return { ...nb, sections: [{ ...sec, count: 0 }] };
    }
    const nb = await get("notebooks", b) || fail(404, "Không tìm thấy sổ tay");
    if (M === "PATCH") { if (body.name !== undefined) nb.name = String(body.name).trim().slice(0, 120) || nb.name; if (body.color) nb.color = body.color; if (body.aiDisabled !== undefined) nb.aiDisabled = !!body.aiDisabled; await put("notebooks", nb); return { ok: true }; }
    if (M === "DELETE") {
      const secs = (await all("sections")).filter((s) => s.notebookId === nb.id);
      await trashSections(secs.map((s) => s.id));
      await del("sections", secs.map((s) => s.id)); await del("notebooks", nb.id);
      return { ok: true };
    }
  }
  if (a === "sections") {
    if (M === "POST" && b === "reorder") { await reorder("sections", body.ids); return { ok: true }; }
    if (M === "POST") {
      const nb = await get("notebooks", body.notebookId) || fail(404, "Không tìm thấy sổ tay");
      const count = (await all("sections")).filter((s) => s.notebookId === nb.id).length;
      const sec = { id: uuid(), notebookId: nb.id, name: String(body.name || "").trim().slice(0, 120) || "Mục mới", color: body.color || "#3b82f6", order: count, createdAt: now() };
      await put("sections", sec);
      return { ...sec, count: 0 };
    }
    const sec = await get("sections", b) || fail(404, "Không tìm thấy mục");
    if (M === "PATCH") { if (body.name !== undefined) sec.name = String(body.name).trim().slice(0, 120) || sec.name; if (body.color) sec.color = body.color; if (body.notebookId) sec.notebookId = body.notebookId; await put("sections", sec); return { ok: true }; }
    if (M === "DELETE") { await trashSections([sec.id]); await del("sections", sec.id); return { ok: true }; }
  }
  if (a === "pages" && !b) {
    if (M === "POST") return createPage(body);
    return listPages(q);
  }
  if (a === "pages" && b === "reorder") { await reorder("pages", body.ids); return { ok: true }; }
  if (a === "pages" && b) {
    const page = await get("pages", b) || fail(404, "Không tìm thấy trang ghi chú");
    if (!c && M === "GET") return fullPage(page);
    if (!c && M === "PATCH") return patchPage(page, body);
    if (!c && M === "DELETE") { const ids = await descendants(page.id); const ps = (await all("pages")).filter((p) => ids.includes(p.id) && !p.deletedAt); ps.forEach((p) => { p.deletedAt = now(); p.pinned = false; }); await put("pages", ps); return { ok: true, count: ps.length }; }
    if (c === "restore") { const ids = await descendants(page.id); const ps = (await all("pages")).filter((p) => ids.includes(p.id)); ps.forEach((p) => { p.deletedAt = null; }); await put("pages", ps); return { ok: true }; }
    if (c === "permanent") { if (!page.deletedAt) fail(404, "Trang không có trong thùng rác"); await hardDelete([page.id]); return { ok: true }; }
    if (c === "duplicate") {
      const copy = { ...page, id: uuid(), title: `${page.title || "Không tiêu đề"} (bản sao)`.slice(0, 300), pinned: false, version: 1, createdAt: now(), updatedAt: now(), order: page.order + 1 };
      await savePage(copy);
      return listItem(copy);
    }
    if (c === "revisions") return (await all("revisions")).filter((r) => r.pageId === page.id).sort((x, y) => y.createdAt.localeCompare(x.createdAt)).map(({ id, title, createdAt }) => ({ id, title, createdAt }));
    if (["links", "shares"].includes(c)) needLogin("Liên kết với lớp học và chia sẻ");
  }
  if (a === "revisions" && b) { const r = await get("revisions", b) || fail(404, "Không tìm thấy phiên bản"); return { id: r.id, title: r.title, contentJson: r.contentJson, createdAt: r.createdAt }; }
  if (a === "trash" && M === "DELETE") { const ids = (await all("pages")).filter((p) => p.deletedAt).map((p) => p.id); await hardDelete(ids); return { ok: true, count: ids.length }; }
  if (a === "tasks" && !b) return listTasks(q.filter || "open");
  if (a === "tasks" && c === "toggle") return toggleTask(b, !!body.done);
  if (a === "attachments" && !b && M === "POST") return addAttachment(form!);
  if (a === "attachments" && b) {
    const att = await get("attachments", b) || fail(404, "Không tìm thấy file");
    if (M === "PATCH") { if (body.ocrText !== undefined) att.ocrText = String(body.ocrText || "").slice(0, 50000); await put("attachments", att); const pg = att.pageId && await get("pages", att.pageId); if (pg) await savePage(pg); return { ok: true }; }
    if (M === "DELETE") { await del("attachments", att.id); return { ok: true }; }
  }
  if (a === "templates") {
    if (M === "GET") return (await all("templates")).sort((x, y) => y.createdAt.localeCompare(x.createdAt));
    if (M === "POST") {
      const page = await get("pages", body.pageId) || fail(404, "Không tìm thấy trang");
      const tpl = { id: uuid(), name: String(body.name || page.title || "Mẫu của tôi").trim().slice(0, 120), description: "", contentJson: page.contentJson, style: page.style || null, tags: page.tags || [], createdAt: now() };
      await put("templates", tpl); return tpl;
    }
    if (M === "DELETE") { await del("templates", b); return { ok: true }; }
  }
  if (a === "export") {
    const [pages, secs, nbs] = await Promise.all([all("pages"), all("sections"), all("notebooks")]);
    const out = pages.filter((p) => !p.deletedAt).map((p) => {
      const s = secs.find((x) => x.id === p.sectionId); const nb = s && nbs.find((x) => x.id === s.notebookId);
      return { id: p.id, title: p.title, contentJson: p.contentJson, style: p.style || null, tags: p.tags, createdAt: p.createdAt, updatedAt: p.updatedAt, parentId: p.parentId, section: s ? { name: s.name, notebook: { name: nb?.name || "" } } : null };
    });
    return { pages: out, next: null, total: out.length };
  }
  if (a === "cleanup" && b === "duplicates") return duplicates();
  if (a === "cleanup" && b === "merge") return merge(body.keepId, body.mergeId);
  if (a === "linked" || a === "shared" || a === "share-teachers") return [];
  if (a === "insights") return { studyDue: 0, overdue: 0, topError: null };
  if (a === "link-targets" || a === "links" || a === "shares") needLogin("Liên kết với nội dung lớp học");
  return fail(404, "Chức năng này cần đăng nhập");
}

async function reorder(store: StoreName, ids: string[]) {
  const rows = await all(store);
  const changed = rows.filter((r) => ids.includes(r.id)).map((r) => ({ ...r, order: ids.indexOf(r.id) }));
  await put(store, changed);
}

async function trashSections(sectionIds: string[]) {
  const ps = (await all("pages")).filter((p) => sectionIds.includes(p.sectionId));
  ps.forEach((p) => { if (!p.deletedAt) p.deletedAt = now(); p.sectionId = null; });
  await put("pages", ps);
}

async function hardDelete(ids: string[]) {
  if (!ids.length) return;
  const [atts, revs] = await Promise.all([all("attachments"), all("revisions")]);
  await del("attachments", atts.filter((x) => ids.includes(x.pageId)).map((x) => x.id));
  await del("revisions", revs.filter((x) => ids.includes(x.pageId)).map((x) => x.id));
  await del("pages", ids);
}

async function bootstrap() {
  // Dọn thùng rác quá 30 ngày
  const pages = await all("pages");
  const old = pages.filter((p) => p.deletedAt && Date.now() - new Date(p.deletedAt).getTime() > 30 * 86400000).map((p) => p.id);
  if (old.length) await hardDelete(old);
  const alive = pages.filter((p) => !p.deletedAt && !old.includes(p.id));
  const [nbs, secs] = await Promise.all([all("notebooks"), all("sections")]);
  const endToday = new Date(); endToday.setHours(23, 59, 59, 999);
  const t = Date.now();
  const tasks = alive.flatMap((p) => tasksOf(p.contentJson)).filter((x) => !x.done && x.dueAt);
  const tagCount: Record<string, number> = {};
  alive.forEach((p) => (p.tags || []).forEach((tag: string) => { tagCount[tag] = (tagCount[tag] || 0) + 1; }));
  const counts = (sid: string | null) => alive.filter((p) => !p.archivedAt && (p.sectionId ?? null) === sid).length;
  const atts = await all("attachments");
  return {
    user: { id: "guest", name: "bạn", role: "GUEST", accessLocked: false, classrooms: [], canLink: false, guest: true },
    notebooks: nbs.sort((x, y) => x.order - y.order).map((nb) => ({
      id: nb.id, name: nb.name, color: nb.color, order: nb.order, aiDisabled: !!nb.aiDisabled,
      sections: secs.filter((s) => s.notebookId === nb.id).sort((x, y) => x.order - y.order).map((s) => ({ id: s.id, name: s.name, color: s.color, order: s.order, count: counts(s.id) })),
    })),
    counts: {
      inbox: counts(null), pinned: alive.filter((p) => p.pinned && !p.archivedAt).length, archived: alive.filter((p) => p.archivedAt).length,
      trash: pages.filter((p) => p.deletedAt && !old.includes(p.id)).length,
      overdue: tasks.filter((x) => new Date(x.dueAt!).getTime() < t).length,
      today: tasks.filter((x) => { const d = new Date(x.dueAt!); return d.getTime() >= t && d <= endToday; }).length,
      studyDue: alive.filter((p) => p.studyDueAt && new Date(p.studyDueAt).getTime() <= t).length, sharedIn: 0,
    },
    reminders: alive.filter((p) => p.remindAt && new Date(p.remindAt) <= endToday).map((p) => ({ id: p.id, title: p.title, remindAt: p.remindAt })),
    tags: Object.entries(tagCount).sort((x, y) => y[1] - x[1]).map(([tag, n]) => ({ tag, n })),
    usage: null,
    storage: { used: atts.reduce((s, x) => s + (x.size || 0), 0), quota: 200 * 1024 * 1024 },
  };
}

async function listPages(q: Record<string, string>) {
  const view = q.view || "all";
  const pages = await all("pages");
  const atts = q.q ? await all("attachments") : [];
  const match = matcher(q.q || "", atts);
  let list = pages.filter((p) => (view === "trash" ? !!p.deletedAt : !p.deletedAt));
  if (view === "archived") list = list.filter((p) => p.archivedAt);
  else if (view !== "trash" && (view !== "all" || !q.q)) list = list.filter((p) => !p.archivedAt);
  if (view === "section") list = list.filter((p) => p.sectionId === q.sectionId);
  if (view === "inbox") list = list.filter((p) => !p.sectionId);
  if (view === "pinned") list = list.filter((p) => p.pinned);
  if (view === "tag") list = list.filter((p) => (p.tags || []).includes(q.tag));
  if (view === "study") list = list.filter((p) => p.studyDueAt && new Date(p.studyDueAt).getTime() <= Date.now());
  list = list.filter(match);
  if (view === "section" && !q.q) list.sort((x, y) => x.order - y.order || x.createdAt.localeCompare(y.createdAt));
  else if (q.sort === "created") list.sort((x, y) => y.createdAt.localeCompare(x.createdAt));
  else if (q.sort === "title") list.sort((x, y) => String(x.title).localeCompare(String(y.title), "vi"));
  else list.sort((x, y) => Number(!!y.pinned) - Number(!!x.pinned) || y.updatedAt.localeCompare(x.updatedAt));
  const skip = Number(q.skip) || 0; const take = Math.min(Number(q.take) || 60, 200);
  return { pages: list.slice(skip, skip + take).map(listItem), total: list.length };
}

async function fullPage(page: Row) {
  const [pages, secs, nbs, atts] = await Promise.all([all("pages"), all("sections"), all("notebooks"), pageAttachments(page.id)]);
  const sec = secs.find((s) => s.id === page.sectionId);
  const nb = sec && nbs.find((n) => n.id === sec.notebookId);
  return {
    ...listItem(page), contentJson: page.contentJson, version: page.version || 1, studyStep: page.studyStep || 0, style: page.style || null,
    section: sec ? { id: sec.id, name: sec.name, notebook: { id: nb?.id, name: nb?.name || "", aiDisabled: !!nb?.aiDisabled } } : null,
    attachments: atts.map(attView), links: [], shares: [],
    children: pages.filter((p) => p.parentId === page.id && !p.deletedAt).sort((x, y) => x.order - y.order).map((p) => ({ id: p.id, title: p.title })),
    backlinks: pages.filter((p) => !p.deletedAt && (p.linkedPageIds || []).includes(page.id)).map((p) => ({ id: p.id, title: p.title })),
  };
}

async function createPage(body: any) {
  const pages = await all("pages");
  let sectionId = body.sectionId || null;
  if (body.parentId) sectionId = pages.find((p) => p.id === body.parentId)?.sectionId ?? null;
  const page: Row = {
    id: uuid(), sectionId, parentId: body.parentId || null, title: String(body.title || "").slice(0, 300), tags: cleanTags(body.tags),
    contentJson: body.contentJson || { type: "doc", content: [{ type: "paragraph" }] }, template: body.template || null, color: body.color || null,
    style: body.style || null, pinned: false, version: 1, order: pages.length, remindAt: null, archivedAt: null, deletedAt: null,
    studyStep: 0, studyDueAt: null, createdAt: now(), updatedAt: now(),
  };
  await savePage(page);
  return { ...listItem(page), version: 1, contentJson: page.contentJson, style: page.style };
}

async function patchPage(page: Row, body: any) {
  const contentChange = body.contentJson !== undefined || body.title !== undefined;
  if (contentChange) {
    if (Number(body.baseVersion) !== (page.version || 1)) fail(409, "Trang đã được sửa ở tab khác", { conflict: true, page: { title: page.title, contentJson: page.contentJson, version: page.version, updatedAt: page.updatedAt } });
    // Lịch sử phiên bản: chụp bản cũ khi lần chụp trước đã ≥10 phút, giữ 30 bản
    if (body.contentJson !== undefined && plain(page.contentJson).trim()) {
      const revs = (await all("revisions")).filter((r) => r.pageId === page.id).sort((x, y) => y.createdAt.localeCompare(x.createdAt));
      if (!revs[0] || Date.now() - new Date(revs[0].createdAt).getTime() > 10 * 60000) {
        await put("revisions", { id: uuid(), pageId: page.id, title: page.title, contentJson: page.contentJson, createdAt: now() });
        if (revs.length >= 30) await del("revisions", revs.slice(29).map((r) => r.id));
      }
    }
    page.version = (page.version || 1) + 1;
    page.updatedAt = now();
  }
  if (body.title !== undefined) page.title = String(body.title).slice(0, 300);
  if (body.contentJson !== undefined) page.contentJson = body.contentJson;
  if (body.tags !== undefined) page.tags = cleanTags(body.tags);
  if (body.color !== undefined) page.color = body.color || null;
  if (body.style !== undefined) page.style = body.style || null;
  if (body.pinned !== undefined) page.pinned = !!body.pinned;
  if (body.archived !== undefined) page.archivedAt = body.archived ? now() : null;
  if (body.remindAt !== undefined) page.remindAt = body.remindAt || null;
  if (body.study !== undefined) { page.studyStep = 0; page.studyDueAt = body.study ? new Date(Date.now() + 86400000).toISOString() : null; }
  if (body.sectionId !== undefined) page.sectionId = body.sectionId || null;
  if (body.parentId !== undefined) {
    if (body.parentId && (await descendants(page.id)).includes(body.parentId)) fail(400, "Không thể chuyển trang vào trang con của chính nó");
    page.parentId = body.parentId || null;
    if (body.parentId && body.sectionId === undefined) page.sectionId = (await get("pages", body.parentId))?.sectionId ?? null;
  }
  if (!contentChange) page.updatedAt = page.updatedAt || now();
  await savePage(page);
  return { ...listItem(page), version: page.version || 1 };
}

async function listTasks(filter: string) {
  const pages = (await all("pages")).filter((p) => !p.deletedAt);
  const out = pages.flatMap((p) => tasksOf(p.contentJson).map((x) => ({ id: `${p.id}:${x.tid}`, text: x.text, done: x.done, dueAt: x.dueAt, tid: x.tid, page: { id: p.id, title: p.title } })))
    .filter((x) => (filter === "open" ? !x.done : filter === "done" ? x.done : true));
  return out.sort((x, y) => Number(x.done) - Number(y.done) || (x.dueAt ? 0 : 1) - (y.dueAt ? 0 : 1) || String(x.dueAt).localeCompare(String(y.dueAt)));
}

async function toggleTask(id: string, done: boolean) {
  const [pageId, tid] = id.split(":");
  const page = await get("pages", pageId) || fail(404, "Không tìm thấy việc cần làm");
  let found = false;
  walk(page.contentJson, (n) => { if (n.type === "taskItem" && n.attrs?.tid === tid) { n.attrs.checked = done; found = true; } });
  if (!found) fail(404, "Việc này không còn trong trang");
  page.version = (page.version || 1) + 1;
  await savePage(page);
  return { ok: true, version: page.version };
}

const toDataUrl = (blob: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });

async function addAttachment(form: FormData) {
  const file = form.get("file") as File | null;
  if (!file) fail(400, "Thiếu file");
  const f = file as File;
  const used = (await all("attachments")).reduce((s, x) => s + (x.size || 0), 0);
  if (used + f.size > 200 * 1024 * 1024) fail(413, "Bộ nhớ ghi chú trên trình duyệt đã đầy (200MB). Hãy xoá bớt file hoặc đăng nhập để lưu trên tài khoản.");
  const kind = f.type.startsWith("image/") ? "IMAGE" : f.type.startsWith("audio/") ? "AUDIO" : "FILE";
  // Ảnh: data URL (nằm luôn trong nội dung trang, không mất khi tải lại). Ghi âm/file khác: Blob + object URL
  const row: Row = { id: uuid(), pageId: (form.get("pageId") as string) || null, kind, name: f.name, mime: f.type, size: f.size, createdAt: now(), ocrText: null, transcript: null };
  if (kind === "IMAGE") row.url = await toDataUrl(f); else row.blob = f;
  await put("attachments", row);
  return attView(row);
}

/** Lưu file ghi âm của khách (đã được server chép lời) vào máy, gắn với trang */
export async function saveLocalAudio(id: string, pageId: string | null, blob: Blob, name: string, transcript: unknown) {
  const row: Row = { id, pageId, kind: "AUDIO", name, mime: blob.type || "audio/webm", size: blob.size, createdAt: now(), blob, transcript, ocrText: null };
  await put("attachments", row);
  if (pageId) { const pg = await get("pages", pageId); if (pg) await savePage(pg); }
  return attView(row);
}

async function duplicates() {
  const pages = (await all("pages")).filter((p) => !p.deletedAt && (p.wordCount || 0) >= 20).slice(0, 600);
  const sets = pages.map((p) => ({ p, words: new Set(normalizeSearch(p.plainText).match(/[a-z0-9]{2,}/g) || []) }));
  const pairs: any[] = [];
  for (let i = 0; i < sets.length; i += 1) for (let j = i + 1; j < sets.length; j += 1) {
    const A = sets[i].words; const B = sets[j].words;
    const small = A.size < B.size ? A : B; const big = small === A ? B : A;
    if (!small.size || small.size / big.size < 0.6) continue;
    let inter = 0; small.forEach((w) => { if (big.has(w)) inter += 1; });
    const score = inter / (A.size + B.size - inter);
    if (score >= 0.75) pairs.push({ score: Math.round(score * 100), a: { id: sets[i].p.id, title: sets[i].p.title, updatedAt: sets[i].p.updatedAt }, b: { id: sets[j].p.id, title: sets[j].p.title, updatedAt: sets[j].p.updatedAt } });
  }
  return pairs.sort((x, y) => y.score - x.score).slice(0, 30);
}

async function merge(keepId: string, mergeId: string) {
  const [A, B] = await Promise.all([get("pages", keepId), get("pages", mergeId)]);
  if (!A || !B) fail(404, "Không tìm thấy trang");
  A!.contentJson = { type: "doc", content: [...(A!.contentJson?.content || []), { type: "horizontalRule" }, { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: `Gộp từ: ${B!.title || "Không tiêu đề"}` }] }, ...(B!.contentJson?.content || [])] };
  A!.tags = cleanTags([...(A!.tags || []), ...(B!.tags || [])]);
  A!.version = (A!.version || 1) + 1; A!.updatedAt = now();
  B!.deletedAt = now();
  const atts = (await all("attachments")).filter((x) => x.pageId === B!.id).map((x) => ({ ...x, pageId: A!.id }));
  await put("attachments", atts);
  await savePage(A!); await put("pages", B!);
  return { ok: true };
}

// ── Thao tác AI cần dữ liệu trên máy (dùng trong api.ts) ──
export async function localPageForAi(pageId: string) {
  const p = await get("pages", pageId);
  if (!p) return null;
  const sec = p.sectionId ? await get("sections", p.sectionId) : null;
  const nb = sec ? await get("notebooks", sec.notebookId) : null;
  if (nb?.aiDisabled) fail(403, "Sổ tay này đang tắt AI. Bật lại trong menu của sổ tay nếu muốn dùng.");
  return { title: p.title || "", text: `${p.title ? `# ${p.title}\n` : ""}${p.plainText || ""}`.trim(), doc: p.contentJson, linkedPageIds: p.linkedPageIds || [] };
}

export async function localAskPages(question: string, scope?: { type?: string; id?: string }) {
  const [pages, secs, nbs, atts] = await Promise.all([all("pages"), all("sections"), all("notebooks"), all("attachments")]);
  const off = new Set(nbs.filter((n) => n.aiDisabled).map((n) => n.id));
  const secNb = Object.fromEntries(secs.map((s) => [s.id, s.notebookId]));
  const terms = (normalizeSearch(question).match(/[a-z0-9]{2,}/g) || []).slice(0, 10);
  let list = pages.filter((p) => !p.deletedAt && !(p.sectionId && off.has(secNb[p.sectionId])));
  if (scope?.type === "notebook") list = list.filter((p) => p.sectionId && secNb[p.sectionId] === scope.id);
  if (scope?.type === "section") list = list.filter((p) => p.sectionId === scope.id);
  if (terms.length) list = list.filter((p) => terms.some((t) => String(p.searchText || "").includes(t)));
  return list.sort((x, y) => y.updatedAt.localeCompare(x.updatedAt)).slice(0, 60).map((p) => ({
    id: p.id, title: p.title, text: p.plainText || "",
    extra: atts.filter((x) => x.pageId === p.id && (x.ocrText || x.transcript)).map((x) => ({ kind: x.kind, text: x.ocrText || (x.transcript || []).map((s: any) => s.text).join(" ") })),
  }));
}

export async function localLinkCandidates(pageId: string) {
  const pages = await all("pages");
  const me = pages.find((p) => p.id === pageId);
  if (!me) return [];
  const freq: Record<string, number> = {};
  (normalizeSearch(`${me.title} ${me.plainText}`).match(/[a-z0-9]{3,}/g) || []).forEach((w) => { freq[w] = (freq[w] || 0) + 1; });
  const top = Object.entries(freq).sort((x, y) => y[1] - x[1]).slice(0, 10).map(([w]) => w);
  return pages.filter((p) => !p.deletedAt && p.id !== pageId && !(me.linkedPageIds || []).includes(p.id) && top.some((t) => String(p.searchText || "").includes(t)))
    .slice(0, 25).map((p) => ({ id: p.id, title: p.title, excerpt: p.excerpt }));
}

export async function localTriageInput() {
  const [pages, secs, nbs] = await Promise.all([all("pages"), all("sections"), all("notebooks")]);
  const on = nbs.filter((n) => !n.aiDisabled);
  return {
    pages: pages.filter((p) => !p.deletedAt && !p.archivedAt && !p.sectionId).sort((x, y) => y.updatedAt.localeCompare(x.updatedAt)).slice(0, 30).map((p) => ({ id: p.id, title: p.title, excerpt: p.excerpt })),
    sections: secs.filter((s) => on.some((n) => n.id === s.notebookId)).map((s) => ({ id: s.id, name: s.name, notebook: on.find((n) => n.id === s.notebookId)?.name || "" })),
  };
}

export async function localTriageApply(items: { pageId: string; sectionId?: string | null; tags?: string[]; title?: string | null }[]) {
  let applied = 0;
  for (const it of items.slice(0, 50)) {
    const p = await get("pages", it.pageId);
    if (!p) continue;
    if (it.sectionId && await get("sections", it.sectionId)) p.sectionId = it.sectionId;
    p.tags = cleanTags([...(p.tags || []), ...(it.tags || [])]);
    if (!p.title && it.title) p.title = it.title;
    await savePage(p);
    applied += 1;
  }
  return { applied };
}

export async function localStudyReview(pageId: string, grade: string) {
  const STEPS = [1, 3, 7, 14, 30, 60];
  const p = await get("pages", pageId) || fail(404, "Không tìm thấy trang");
  let step = p.studyStep || 0;
  step = grade === "again" ? 0 : grade === "easy" ? step + 2 : step + 1;
  const done = step >= STEPS.length;
  const days = grade === "again" ? 1 : STEPS[Math.min(step, STEPS.length - 1)];
  p.studyStep = done ? 0 : step;
  p.studyDueAt = done ? null : new Date(Date.now() + days * 86400000).toISOString();
  await put("pages", p);
  return { studyDueAt: p.studyDueAt, done, days };
}

export async function localDigest() {
  const pages = (await all("pages")).filter((p) => !p.deletedAt);
  const since = Date.now() - 7 * 86400000;
  const edited = pages.filter((p) => new Date(p.updatedAt).getTime() >= since);
  const open = pages.flatMap((p) => tasksOf(p.contentJson)).filter((x) => !x.done);
  return {
    empty: true,
    stats: {
      pagesEdited: edited.length, words: edited.reduce((s, p) => s + (p.wordCount || 0), 0), openTasks: open.length,
      overdue: open.filter((x) => x.dueAt && new Date(x.dueAt).getTime() < Date.now()).map((x) => x.text).slice(0, 5),
      studyDue: pages.filter((p) => p.studyDueAt && new Date(p.studyDueAt).getTime() <= Date.now()).map((p) => ({ id: p.id, title: p.title })).slice(0, 5),
      topErrors: [],
    },
  };
}

// ── Đưa ghi chú trên máy lên tài khoản sau khi đăng nhập ──
export async function localStats() {
  try { const pages = await all("pages"); return { pages: pages.filter((p) => !p.deletedAt).length }; } catch { return { pages: 0 }; }
}

/** Đưa toàn bộ sổ/mục/trang (kèm ảnh, ghi âm, mẫu) lên tài khoản. `api` = notesApi của chế độ đăng nhập.
 *  Giai đoạn 1 tải hết ảnh/ghi âm lên kho trước — lỗi ở bất kỳ file nào thì xoá các file vừa tải và dừng, KHÔNG tạo gì
 *  trên tài khoản và dữ liệu trên máy giữ nguyên (người gọi chỉ xoá dữ liệu máy khi hàm này chạy xong). */
export async function migrateGuestNotes(api: (path: string, opts?: any) => Promise<any>, onProgress?: (done: number, total: number) => void) {
  const [nbs, secs, pagesAll, atts, tpls] = await Promise.all([all("notebooks"), all("sections"), all("pages"), all("attachments"), all("templates")]);
  const pages = pagesAll.filter((p) => !p.deletedAt);
  const docs = new Map<string, JSONContent>(pages.map((p) => [p.id, JSON.parse(JSON.stringify(p.contentJson || { type: "doc", content: [{ type: "paragraph" }] }))]));
  const tplDocs = new Map<string, JSONContent>(tpls.map((t) => [t.id, JSON.parse(JSON.stringify(t.contentJson || { type: "doc", content: [] }))]));

  // ── Giai đoạn 1: tải file ──
  const uploaded: string[] = [];
  const imageUrl = new Map<string, { id: string; url: string }>();
  const audioMap: Record<string, { id: string; url: string }> = {};
  const imagesIn = (doc: JSONContent) => { const out: JSONContent[] = []; walk(doc, (n) => { if (n.type === "image" && String(n.attrs?.src || "").startsWith("data:")) out.push(n); }); return out; };
  const allImages = [...docs.values(), ...tplDocs.values()].flatMap(imagesIn);
  const audios = atts.filter((x) => x.blob && pages.some((p) => p.id === x.pageId));
  const totalFiles = new Set(allImages.map((n) => n.attrs!.src)).size + audios.length;
  let fileDone = 0;
  const upload = async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    const up = await api("/attachments", { form });
    uploaded.push(up.id);
    fileDone += 1;
    onProgress?.(fileDone, totalFiles + pages.length);
    return up as { id: string; url: string };
  };
  try {
    for (const img of allImages) {
      const src = img.attrs!.src as string;
      if (!imageUrl.has(src)) {
        const blob = await (await fetch(src)).blob();
        imageUrl.set(src, await upload(new File([blob], `anh-${Date.now()}.${(blob.type.split("/")[1] || "png").replace("jpeg", "jpg")}`, { type: blob.type })));
      }
    }
    for (const a of audios) {
      const ext = a.mime.includes("mp4") ? "m4a" : "webm";
      audioMap[a.id] = await upload(new File([a.blob], /\.\w{2,4}$/.test(a.name) ? a.name : `${a.name}.${ext}`, { type: a.mime }));
      if (a.transcript) await api(`/attachments/${audioMap[a.id].id}`, { method: "PATCH", body: { transcript: a.transcript } });
    }
  } catch (err) {
    await Promise.all(uploaded.map((id) => api(`/attachments/${id}`, { method: "DELETE" }).catch(() => {})));
    throw new Error(`Không tải được ảnh/ghi âm lên kho lưu trữ (${(err as Error)?.message || "lỗi máy chủ"}). Chưa có gì bị thay đổi — ghi chú trên máy vẫn còn nguyên, hãy thử lại sau.`);
  }
  const replaceMedia = (doc: JSONContent) => walk(doc, (n) => {
    if (n.type === "image" && imageUrl.has(n.attrs?.src)) n.attrs = { ...n.attrs, src: imageUrl.get(n.attrs!.src)!.url };
    if (n.type === "audioNote" && audioMap[n.attrs?.attachmentId]) { const m = audioMap[n.attrs!.attachmentId]; n.attrs = { ...n.attrs, attachmentId: m.id, url: m.url }; }
    (n.marks || []).forEach((mk) => {
      const t = /^#t=(\d+)&a=(.+)$/.exec(String(mk.attrs?.href || ""));
      if (t && audioMap[t[2]]) mk.attrs!.href = `#t=${t[1]}&a=${audioMap[t[2]].id}`;
    });
  });
  docs.forEach(replaceMedia);
  tplDocs.forEach(replaceMedia);

  // ── Giai đoạn 2: sổ, mục, trang (cha trước con sau) ──
  const secMap: Record<string, string> = {};
  for (const nb of nbs.sort((x, y) => x.order - y.order)) {
    const created = await api("/notebooks", { body: { name: nb.name, color: nb.color } });
    if (nb.aiDisabled) await api(`/notebooks/${created.id}`, { method: "PATCH", body: { aiDisabled: true } });
    const mine = secs.filter((x) => x.notebookId === nb.id).sort((x, y) => x.order - y.order);
    for (let i = 0; i < mine.length; i += 1) {
      if (i === 0) { await api(`/sections/${created.sections[0].id}`, { method: "PATCH", body: { name: mine[0].name, color: mine[0].color } }); secMap[mine[0].id] = created.sections[0].id; }
      else { const sec = await api("/sections", { body: { notebookId: created.id, name: mine[i].name, color: mine[i].color } }); secMap[mine[i].id] = sec.id; }
    }
  }
  const depth = (p: Row, seen = 0): number => (p.parentId && seen < 5 ? 1 + depth(pages.find((x) => x.id === p.parentId) || { id: "", parentId: null }, seen + 1) : 0);
  const ordered = [...pages].sort((x, y) => depth(x) - depth(y) || x.order - y.order);
  const pageMap: Record<string, string> = {};
  for (const p of ordered) {
    const created = await api("/pages", { body: { sectionId: p.sectionId ? secMap[p.sectionId] || null : null, parentId: p.parentId ? pageMap[p.parentId] || null : null, title: p.title, tags: p.tags, color: p.color, style: p.style, template: p.template } });
    pageMap[p.id] = created.id;
  }
  // Ghi nội dung sau cùng để liên kết [[trang]] trỏ đúng id mới, rồi gắn file đính kèm vào trang
  let done = 0;
  for (const p of ordered) {
    const doc = docs.get(p.id)!;
    walk(doc, (n) => (n.marks || []).forEach((mk) => {
      const hit = mk.type === "link" && /^\/notes\?p=([0-9a-f-]{36})/i.exec(String(mk.attrs?.href || ""));
      if (hit && pageMap[hit[1]]) mk.attrs!.href = `/notes?p=${pageMap[hit[1]]}`;
    }));
    const patch: any = { baseVersion: 1, title: p.title, contentJson: doc };
    if (p.pinned) patch.pinned = true;
    if (p.archivedAt) patch.archived = true;
    if (p.remindAt) patch.remindAt = p.remindAt;
    await api(`/pages/${pageMap[p.id]}`, { method: "PATCH", body: patch });
    const used = new Set<string>();
    walk(doc, (n) => {
      if (n.type === "image") imageUrl.forEach((v) => { if (v.url === n.attrs?.src) used.add(v.id); });
      if (n.type === "audioNote" && n.attrs?.attachmentId) used.add(n.attrs.attachmentId);
    });
    atts.filter((a) => a.pageId === p.id && audioMap[a.id]).forEach((a) => used.add(audioMap[a.id].id));
    await Promise.all([...used].map((id) => api(`/attachments/${id}`, { method: "PATCH", body: { pageId: pageMap[p.id] } }).catch(() => {})));
    done += 1;
    onProgress?.(fileDone + done, totalFiles + pages.length);
  }
  for (const t of tpls) {
    // Mẫu riêng: tạo trang tạm từ mẫu → lưu thành mẫu → xoá hẳn trang tạm
    const tmp = await api("/pages", { body: { title: t.name, contentJson: tplDocs.get(t.id), style: t.style, tags: t.tags } }).catch(() => null);
    if (!tmp) continue;
    await api("/templates", { body: { pageId: tmp.id, name: t.name } }).catch(() => {});
    await api(`/pages/${tmp.id}`, { method: "DELETE" }).catch(() => {});
    await api(`/pages/${tmp.id}/permanent`, { method: "DELETE" }).catch(() => {});
  }
  return { pages: ordered.length };
}

export async function clearGuestNotes() {
  for (const s of STORES) { const rows = await all(s); await del(s, rows.map((r) => r.id)); }
}
