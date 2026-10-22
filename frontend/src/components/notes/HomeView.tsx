"use client";
// Trang chủ Ghi chú: thao tác nhanh, bản tin tuần (AI), việc hôm nay, trang cần ôn, hồ sơ lỗi tiếng Anh, dọn dẹp.
import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { aiApi, notesApi, errMsg } from "./api";
import { Modal, Spinner, timeAgo } from "./ui";
import type { Bootstrap, PageItem } from "./types";

type Digest = { empty?: boolean; pending?: boolean; headline?: string; themes?: string[]; suggestions?: string[]; stats: { pagesEdited: number; words: number; openTasks: number; overdue: string[]; studyDue: { id: string; title: string }[]; topErrors: { category: string; count: number }[] } };
type Profile = { total: number; categories: { category: string; count: number; previous: number; examples: { original: string; corrected: string; explanation: string }[] }[] };
type Suggestion = { pageId: string; pageTitle: string; excerpt: string; sectionId: string | null; sectionLabel: string | null; tags: string[]; title: string | null };

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="ui-card p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-3"><h2 className="ui-section-title text-base">{title}</h2><span className="ml-auto">{action}</span></div>
      {children}
    </section>
  );
}

export default function HomeView({ boot, onOpen, onNewPage, onRecordNew, onOcrNew, onAsk, onAgent, refreshBoot, refreshList }: {
  boot: Bootstrap; onOpen: (id: string) => void; onNewPage: () => void; onRecordNew: () => void; onOcrNew: () => void;
  onAsk: () => void; onAgent: () => void; refreshBoot: () => void; refreshList: () => void;
}) {
  const [recent, setRecent] = useState<PageItem[] | null>(null);
  const [digest, setDigest] = useState<Digest | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tasks, setTasks] = useState<{ id: string; text: string; done: boolean; dueAt: string | null; page: { id: string; title: string } }[]>([]);
  const [triage, setTriage] = useState<{ items: (Suggestion & { on: boolean })[] } | null>(null);
  const [triageLoading, setTriageLoading] = useState(false);
  const [dups, setDups] = useState<{ score: number; a: { id: string; title: string }; b: { id: string; title: string } }[] | null>(null);

  useEffect(() => {
    notesApi<{ pages: PageItem[] }>("/pages?view=all&take=8").then((r) => setRecent(r.pages)).catch(() => setRecent([]));
    notesApi("/tasks?filter=open").then((t) => setTasks(t.filter((x: { dueAt: string | null }) => x.dueAt && new Date(x.dueAt).getTime() < Date.now() + 86400000).slice(0, 6))).catch(() => {});
    aiApi<Digest>("/digest").then((d) => { setDigest(d); if (!d.empty && !d.pending) refreshBoot(); }).catch(() => {});
    aiApi<Profile>("/journal/profile").then(setProfile).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runTriage = async () => {
    setTriageLoading(true);
    try {
      const r = await aiApi<{ suggestions: Suggestion[] }>("/triage", { body: {} });
      if (!r.suggestions.length) { Swal.fire({ icon: "info", text: "Hộp thư ghi nhanh đang trống." }); return; }
      setTriage({ items: r.suggestions.map((s) => ({ ...s, on: !!s.sectionId })) });
      refreshBoot();
    } catch (err) { Swal.fire({ icon: "error", text: errMsg(err) }); } finally { setTriageLoading(false); }
  };
  const applyTriage = async () => {
    if (!triage) return;
    try {
      const r = await aiApi<{ applied: number }>("/triage/apply", { body: { items: triage.items.filter((i) => i.on) } });
      setTriage(null); refreshBoot(); refreshList();
      Swal.fire({ icon: "success", text: `Đã sắp xếp ${r.applied} ghi chú.`, timer: 1600, showConfirmButton: false });
    } catch (err) { Swal.fire({ icon: "error", text: errMsg(err) }); }
  };
  const findDups = async () => {
    try { setDups(await notesApi("/cleanup/duplicates")); } catch (err) { Swal.fire({ icon: "error", text: errMsg(err) }); }
  };
  const merge = async (keepId: string, mergeId: string) => {
    const r = await Swal.fire({ icon: "question", text: "Gộp nội dung trang thứ hai vào cuối trang thứ nhất, rồi đưa trang thứ hai vào thùng rác?", showCancelButton: true, confirmButtonText: "Gộp", cancelButtonText: "Huỷ" });
    if (!r.isConfirmed) return;
    try { await notesApi("/cleanup/merge", { body: { keepId, mergeId } }); setDups((d) => d?.filter((x) => x.a.id !== keepId || x.b.id !== mergeId) || null); refreshBoot(); refreshList(); }
    catch (err) { Swal.fire({ icon: "error", text: errMsg(err) }); }
  };

  const hour = new Date().getHours();
  const greet = hour < 11 ? "Chào buổi sáng" : hour < 14 ? "Chào buổi trưa" : hour < 18 ? "Chào buổi chiều" : "Chào buổi tối";
  const actions: [string, string, () => void][] = [
    ["Trang mới", "Chọn mẫu: việc cần làm, họp, Cornell, từ vựng…", onNewPage],
    ["Ghi âm thành ghi chú", "AI chép lời, chia ý, gắn mốc thời gian", onRecordNew],
    ["Chụp vở / bảng", "Ảnh → chữ → trang ghi chú sạch", onOcrNew],
    ["Hỏi sổ ghi chú", "Trả lời từ chính ghi chú của bạn, có trích dẫn", onAsk],
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <div>
          <p className="text-sm text-muted">Trang chủ / Ghi chú</p>
          <h1 className="ui-page-title mt-1">{greet}, {boot.user.name.split(" ").slice(-1)[0]}</h1>
          <p className="ui-page-subtitle">Ghi mọi thứ ở một nơi — AI giúp sắp xếp, tóm tắt và biến ghi chú thành bài ôn.{boot.user.guest ? " Miễn phí, không cần đăng nhập." : ""}</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {actions.map(([t, d, fn]) => (
            <button key={t} type="button" onClick={fn} className="ui-card ui-card-hover p-4 text-left">
              <span className="block font-bold text-primary">{t}</span>
              <span className="block text-xs text-muted mt-1">{d}</span>
            </button>
          ))}
        </div>

        {boot.user.accessLocked && <p className="rounded-xl bg-amber-50 text-amber-800 p-3 text-sm">Tài khoản đang bị khoá nên các tính năng AI tạm ngưng. Ghi chú của bạn vẫn xem, sửa và xuất được bình thường.</p>}

        <div className="grid lg:grid-cols-2 gap-5">
          <Card title="Bản tin tuần">
            {!digest ? <Spinner label="Đang tổng hợp…" /> : boot.user.guest ? (
              <div className="text-sm text-muted space-y-2">
                <p>Tuần này: {digest.stats.pagesEdited} trang · {digest.stats.words.toLocaleString("vi-VN")} từ · {digest.stats.openTasks} việc chưa xong.</p>
                <p>Đăng nhập để AI tự tổng hợp chủ đề chính và gợi ý cho tuần tới mỗi thứ Hai.</p>
              </div>
            ) : digest.empty ? (
              <p className="text-sm text-muted">Tuần này bạn mới sửa {digest.stats.pagesEdited} trang. Ghi thêm vài trang, bản tin AI sẽ tự tổng hợp chủ đề chính và gợi ý cho tuần tới.</p>
            ) : (
              <div className="space-y-2 text-sm">
                {digest.headline && <p className="font-bold text-foreground">{digest.headline}</p>}
                <p className="text-muted">{digest.stats.pagesEdited} trang · {digest.stats.words.toLocaleString("vi-VN")} từ · {digest.stats.openTasks} việc chưa xong</p>
                {!!digest.themes?.length && <p className="flex flex-wrap gap-1">{digest.themes.map((t) => <span key={t} className="ui-badge">{t}</span>)}</p>}
                {!!digest.suggestions?.length && <ul className="list-disc pl-5 space-y-0.5">{digest.suggestions.map((s) => <li key={s}>{s}</li>)}</ul>}
                {digest.pending && <p className="text-xs text-muted">Hết lượt AI hôm nay — phần nhận xét sẽ được tạo lần sau.</p>}
              </div>
            )}
          </Card>

          <Card title="Hôm nay">
            {!tasks.length && !boot.reminders.length && !boot.counts.studyDue ? <p className="text-sm text-muted">Không có việc đến hạn, nhắc nhở hay trang cần ôn hôm nay.</p> : (
              <ul className="space-y-1.5 text-sm">
                {tasks.map((t) => (
                  <li key={t.id}><button type="button" onClick={() => onOpen(t.page.id)} className="w-full text-left rounded-lg border border-line px-3 py-2 hover:border-primary">
                    <span className="font-semibold">{t.text}</span>
                    <span className={`block text-xs ${t.dueAt && new Date(t.dueAt) < new Date() ? "text-red-700 font-bold" : "text-muted"}`}>Hạn {t.dueAt && new Date(t.dueAt).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })} · {t.page.title || "Không tiêu đề"}</span>
                  </button></li>
                ))}
                {boot.reminders.map((r) => (
                  <li key={r.id}><button type="button" onClick={() => onOpen(r.id)} className="w-full text-left rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2"><span className="font-semibold">Xem lại: {r.title || "Không tiêu đề"}</span><span className="block text-xs text-muted">Nhắc lúc {new Date(r.remindAt).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}</span></button></li>
                ))}
                {boot.counts.studyDue > 0 && <li className="text-sm text-primary font-bold">{boot.counts.studyDue} trang đến hạn ôn — mở mục "Ôn hôm nay" ở cột trái.</li>}
              </ul>
            )}
          </Card>
        </div>

        <Card title="Mới sửa gần đây">
          {!recent ? <Spinner /> : !recent.length ? (
            <div className="text-center py-6">
              <p className="text-sm text-muted">Chưa có ghi chú nào. Bắt đầu bằng một trang mới hoặc ghi âm buổi học tiếp theo.</p>
              <button type="button" onClick={onNewPage} className="btn-primary mt-3 px-5 py-2">Tạo trang đầu tiên</button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2">
              {recent.map((p) => (
                <button key={p.id} type="button" onClick={() => onOpen(p.id)} className="text-left rounded-xl border border-line p-3 hover:border-primary" style={p.color ? { borderLeft: `4px solid ${p.color}` } : undefined}>
                  <span className="block font-bold text-sm truncate">{p.title || "Không tiêu đề"}</span>
                  <span className="block text-xs text-muted line-clamp-2 mt-0.5">{p.excerpt || "Trang trống"}</span>
                  <span className="block text-[11px] text-muted mt-1">{timeAgo(p.updatedAt)}</span>
                </button>
              ))}
            </div>
          )}
        </Card>

        {profile && profile.total > 0 && (
          <Card title="Hồ sơ lỗi tiếng Anh · 30 ngày">
            <p className="text-sm text-muted mb-3">Từ các lần "Sửa lỗi bài viết" trong ghi chú. So với 30 ngày trước đó.</p>
            <div className="space-y-2">
              {profile.categories.slice(0, 5).map((c) => (
                <details key={c.category} className="rounded-xl border border-line px-3 py-2">
                  <summary className="cursor-pointer text-sm flex items-center gap-2">
                    <b>{c.category}</b><span className="ui-badge bg-red-50 text-red-700">{c.count} lỗi</span>
                    {c.previous > 0 && <span className={`text-xs ${c.count < c.previous ? "text-emerald-700" : "text-red-700"}`}>{c.count < c.previous ? `giảm ${c.previous - c.count}` : c.count > c.previous ? `tăng ${c.count - c.previous}` : "không đổi"}</span>}
                  </summary>
                  <ul className="mt-2 space-y-1.5 text-sm">{c.examples.map((e, i) => <li key={i}><span className="line-through text-red-700/80">{e.original}</span> → <span className="text-emerald-700 font-semibold">{e.corrected}</span><span className="block text-xs text-muted">{e.explanation}</span></li>)}</ul>
                </details>
              ))}
            </div>
          </Card>
        )}

        <div className="grid lg:grid-cols-3 gap-5">
          <Card title="Sắp xếp hộp thư">
            <p className="text-sm text-muted mb-3">{boot.counts.inbox ? `${boot.counts.inbox} ghi chú nhanh chưa có chỗ. AI đề xuất mục + thẻ cho từng ghi chú, bạn duyệt rồi áp dụng.` : "Hộp thư ghi nhanh đang trống."}</p>
            <button type="button" disabled={!boot.counts.inbox || triageLoading || boot.user.accessLocked} onClick={runTriage} className="btn-outline w-full py-2 text-sm">{triageLoading ? "AI đang xem…" : "AI sắp xếp giúp"}</button>
          </Card>
          <Card title="Dọn trang trùng">
            <p className="text-sm text-muted mb-3">Tìm các trang có nội dung gần như giống nhau để gộp lại (không dùng AI).</p>
            <button type="button" onClick={findDups} className="btn-outline w-full py-2 text-sm">Tìm trang trùng</button>
          </Card>
          <Card title="Sắp xếp bằng lời">
            <p className="text-sm text-muted mb-3">Ví dụ: "Gắn thẻ ielts cho mọi trang có chữ writing rồi chuyển vào sổ IELTS". Xem trước rồi mới làm, hoàn tác được.</p>
            {boot.user.guest
              ? <a href="/auth?role=STUDENT&next=/notes" className="btn-outline block text-center w-full py-2 text-sm">Đăng nhập để dùng</a>
              : <button type="button" disabled={boot.user.accessLocked} onClick={onAgent} className="btn-outline w-full py-2 text-sm">Mở trợ lý</button>}
          </Card>
        </div>
      </div>

      <Modal open={!!triage} onClose={() => setTriage(null)} title="AI đề xuất sắp xếp hộp thư" wide footer={<><button type="button" onClick={() => setTriage(null)} className="btn-ghost px-4 py-2">Huỷ</button><button type="button" onClick={applyTriage} className="btn-primary px-4 py-2">Áp dụng {triage?.items.filter((i) => i.on).length} mục</button></>}>
        <ul className="space-y-2">
          {triage?.items.map((it, i) => (
            <li key={it.pageId}>
              <label className="flex gap-3 rounded-xl border border-line p-3 text-sm cursor-pointer">
                <input type="checkbox" checked={it.on} onChange={() => setTriage({ items: triage.items.map((x, j) => (j === i ? { ...x, on: !x.on } : x)) })} className="mt-1" />
                <span className="min-w-0">
                  <b>{it.title || it.pageTitle}</b>{it.title && <span className="text-xs text-muted"> (tiêu đề AI đặt)</span>}
                  <span className="block text-xs text-muted line-clamp-1">{it.excerpt}</span>
                  <span className="block mt-1">→ {it.sectionLabel || <span className="text-muted">giữ trong hộp thư</span>} {it.tags.map((t) => <span key={t} className="ui-badge ml-1">#{t}</span>)}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </Modal>

      <Modal open={!!dups} onClose={() => setDups(null)} title="Trang gần như trùng nhau" wide>
        {dups && !dups.length ? <p className="text-sm text-muted">Không thấy trang trùng nào.</p> : (
          <ul className="space-y-2">
            {dups?.map((d) => (
              <li key={`${d.a.id}${d.b.id}`} className="rounded-xl border border-line p-3 text-sm">
                <p className="text-xs text-muted mb-1">Giống {d.score}%</p>
                <div className="flex flex-wrap gap-2 items-center">
                  <button type="button" onClick={() => { setDups(null); onOpen(d.a.id); }} className="font-bold text-primary hover:underline">{d.a.title || "Không tiêu đề"}</button>
                  <span className="text-muted">và</span>
                  <button type="button" onClick={() => { setDups(null); onOpen(d.b.id); }} className="font-bold text-primary hover:underline">{d.b.title || "Không tiêu đề"}</button>
                  <button type="button" onClick={() => merge(d.a.id, d.b.id)} className="btn-outline ml-auto px-3 py-1.5 text-xs">Gộp</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
}
