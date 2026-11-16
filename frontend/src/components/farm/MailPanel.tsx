"use client";
import { useCallback, useEffect, useState } from "react";
import Modal from "./Modal";
import { farmApi, type Catalog, type FarmState, type MailBox, type MailCheck } from "@/lib/farm/api";

// Hộp thư tiếng Anh giữa bạn cùng lớp: nhắn tin + AI sửa lỗi trước khi gửi, nhờ giúp nông sản (người nhận bấm "Giúp" để gửi hàng).
// Chỉ nhắn được bạn cùng lớp (hoặc cùng giáo viên phụ trách với học viên tự do) — server kiểm tra.
const enCrop = (key: string, n: number) => (n === 1 ? key : key === "strawberry" ? "strawberries" : key === "tomato" ? "tomatoes" : `${key}s`);
const GREETINGS: [string, string][] = [
  ["Hello! How are you today?", "Xin chào! Hôm nay bạn thế nào?"],
  ["How is your farm?", "Nông trại của bạn thế nào?"],
  ["Thank you for visiting my farm!", "Cảm ơn bạn đã ghé thăm nông trại!"],
  ["What is your favourite crop?", "Cây trồng bạn thích nhất là gì?"],
  ["Good luck with your harvest!", "Chúc bạn thu hoạch thật nhiều!"],
];
const REPLIES: [string, string][] = [
  ["I am fine, thank you. And you?", "Mình khỏe, cảm ơn. Còn bạn?"],
  ["Thank you! Your farm looks great.", "Cảm ơn! Nông trại của bạn trông tuyệt quá."],
  ["Sure! I will help you.", "Được chứ! Mình sẽ giúp bạn."],
];
const timeAgo = (iso: string) => { const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000); return m < 1 ? "vừa xong" : m < 60 ? `${m} phút trước` : m < 1440 ? `${Math.round(m / 60)} giờ trước` : `${Math.round(m / 1440)} ngày trước`; };

export default function MailPanel({ userId, catalog, onClose, onState, onToast, onReload, initialTab = "inbox" }: {
  userId: string; catalog: Catalog; onClose: () => void; onState: (s: FarmState) => void; onToast: (m: string) => void; onReload: () => void; initialTab?: "inbox" | "write";
}) {
  const [tab, setTab] = useState<"inbox" | "write">(initialTab);
  const [box, setBox] = useState<MailBox | null>(null);
  const [toId, setToId] = useState("");
  const [type, setType] = useState<"MSG" | "ASK">("MSG");
  const [crop, setCrop] = useState("carrot"); const [n, setN] = useState(3);
  const [text, setText] = useState("");
  const [check, setCheck] = useState<MailCheck | null>(null);
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    try { const b = await farmApi.mailBox(userId); setBox(b); setToId((cur) => cur || b.contacts[0]?.id || ""); return b; } catch (e: any) { onToast(e.message); return null; }
  }, [userId, onToast]);
  useEffect(() => { load(); }, [load]);
  // mở hộp thư = đánh dấu đã đọc (huy hiệu trên nút Thư biến mất)
  useEffect(() => { if (tab === "inbox" && box && box.unread > 0) { farmApi.mailRead(userId).then(() => onReload()).catch(() => { }); } }, [tab, box, userId, onReload]);

  const maxLen = box?.limits.maxLen ?? catalog.mail.maxLen;
  const askText = (c: string, k: number) => `Could you give me ${k} ${enCrop(c, k)}, please?`;
  const words = (text.match(/[A-Za-zÀ-ỹ']+/g) || []).length;

  const doCheck = async () => {
    setBusy("check"); setCheck(null);
    try { setCheck(await farmApi.mailCheck(userId, text)); } catch (e: any) { onToast(e.message); } finally { setBusy(""); }
  };
  const doSend = async () => {
    setBusy("send");
    try {
      const s = await farmApi.mailSend(userId, toId, text, type, type === "ASK" ? { crop, n } : undefined);
      onState(s); setText(""); setCheck(null);
      onToast(`Đã gửi thư cho ${s.mailSent?.to}${s.mailSent?.coins ? ` (+${s.mailSent.coins} xu)` : ""}`);
      await load(); setTab("inbox");
    } catch (e: any) { onToast(e.message); } finally { setBusy(""); }
  };
  const doHelp = async (id: string) => {
    setBusy(id);
    try { const s = await farmApi.mailHelp(userId, id); onState(s); onToast(`Đã giúp ${s.helped?.to}: ${s.helped?.n} ${enCrop(s.helped?.crop || "", s.helped?.n || 1)}${s.helped?.coins ? ` (+${s.helped.coins} xu)` : ""}`); await load(); } catch (e: any) { onToast(e.message); } finally { setBusy(""); }
  };
  const replyTo = (fromId: string) => { setToId(fromId); setType("MSG"); setText(""); setCheck(null); setTab("write"); };

  const limits = box?.limits;
  return (
    <Modal title="Thư tiếng Anh" subtitle="Nhắn cho bạn cùng lớp bằng tiếng Anh — AI giúp sửa lỗi trước khi gửi" onClose={onClose} wide>
      <div role="tablist" className="flex gap-2 mb-3">
        <button role="tab" aria-selected={tab === "inbox"} onClick={() => setTab("inbox")} className={`ui-chip ${tab === "inbox" ? "ui-chip-active" : ""}`}>Hộp thư{box && box.mail.length ? ` (${box.mail.length})` : ""}</button>
        <button role="tab" aria-selected={tab === "write"} onClick={() => setTab("write")} className={`ui-chip ${tab === "write" ? "ui-chip-active" : ""}`}>Viết thư</button>
      </div>

      {!box ? <p className="text-sm text-muted">Đang mở hộp thư...</p> : tab === "inbox" ? (
        box.mail.length === 0 ? <p className="text-sm text-muted rounded-xl bg-primary-soft px-4 py-3">Chưa có thư nào. Hãy viết thư tiếng Anh đầu tiên cho một người bạn nhé!</p> : (
          <ul className="space-y-2">
            {box.mail.map((m) => (
              <li key={m.id} className={`rounded-xl border px-3 py-2.5 ${m.read ? "border-line" : "border-primary bg-primary-soft/50"}`}>
                <div className="flex items-center justify-between gap-2 text-xs text-muted"><b className="text-primary">{m.fromName}</b><span>{timeAgo(m.at)}</span></div>
                <p className="mt-1 text-sm text-foreground" lang="en">{m.text}</p>
                {m.type === "ASK" && m.ask && (
                  <p className="mt-1 text-xs text-amber-800 bg-amber-50 rounded-lg px-2 py-1">Nhờ bạn gửi {m.ask.n} {catalog.crops[m.ask.crop]?.name.toLowerCase()} {catalog.crops[m.ask.crop]?.emoji} ({enCrop(m.ask.crop, m.ask.n)}) từ Kho của bạn. Bạn được thưởng xu khi giúp.</p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  {m.type === "ASK" && (m.helped ? <span className="ui-badge bg-emerald-100 text-emerald-800">Đã giúp</span> : <button disabled={busy === m.id} onClick={() => doHelp(m.id)} className="btn-primary rounded-full px-4 py-1.5 text-xs font-bold disabled:opacity-50">{busy === m.id ? "..." : `Giúp bạn (gửi ${m.ask?.n})`}</button>)}
                  {m.type !== "THANKS" && <button onClick={() => replyTo(m.from)} className="btn-outline rounded-full px-4 py-1.5 text-xs font-bold">Trả lời</button>}
                </div>
              </li>
            ))}
          </ul>
        )
      ) : (
        box.contacts.length === 0 ? (
          <p className="text-sm text-muted rounded-xl bg-amber-50 text-amber-900 px-4 py-3">Bạn nhắn được các bạn <b>cùng lớp</b> (hoặc cùng giáo viên phụ trách) đã mở nông trại. Hiện chưa có bạn nào trong danh sách — hãy vào lớp học bằng mã lớp ở Cài đặt, hoặc rủ bạn cùng lớp vào chơi nhé.</p>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-xs font-bold text-muted">Gửi cho
                <select value={toId} onChange={(e) => setToId(e.target.value)} className="ui-input w-full mt-1 text-sm">{box.contacts.map((c) => <option key={c.id} value={c.id}>{c.name} · cấp {c.level}</option>)}</select>
              </label>
              <div className="text-xs font-bold text-muted">Loại thư
                <div className="flex gap-2 mt-1">
                  <button onClick={() => { setType("MSG"); setCheck(null); }} className={`ui-chip ${type === "MSG" ? "ui-chip-active" : ""}`}>Lời nhắn</button>
                  <button onClick={() => { setType("ASK"); setCheck(null); setText(askText(crop, n)); }} className={`ui-chip ${type === "ASK" ? "ui-chip-active" : ""}`}>Nhờ giúp nông sản</button>
                </div>
              </div>
            </div>
            {type === "ASK" && (
              <div className="flex flex-wrap items-end gap-2 rounded-xl bg-amber-50 px-3 py-2">
                <label className="text-xs font-bold text-amber-900">Cần
                  <select value={crop} onChange={(e) => { setCrop(e.target.value); setText(askText(e.target.value, n)); setCheck(null); }} className="ui-input mt-1 text-sm">
                    {Object.entries(catalog.crops).map(([k, c]) => <option key={k} value={k}>{c.emoji} {c.name} ({k})</option>)}
                  </select>
                </label>
                <label className="text-xs font-bold text-amber-900">Số lượng
                  <input type="number" min={1} max={catalog.mail.askMax} value={n} onChange={(e) => { const v = Math.max(1, Math.min(catalog.mail.askMax, Number(e.target.value) || 1)); setN(v); setText(askText(crop, v)); setCheck(null); }} className="ui-input mt-1 w-20 text-sm" />
                </label>
                <p className="text-xs text-amber-900 flex-1 min-w-[160px]">Bạn đã nhờ {limits?.asks ?? 0}/{limits?.maxAsks ?? 3} lần hôm nay. Bạn nhận được hàng khi người kia bấm &ldquo;Giúp bạn&rdquo;.</p>
              </div>
            )}
            <div>
              <textarea value={text} onChange={(e) => { setText(e.target.value.slice(0, maxLen)); setCheck(null); }} rows={3} placeholder="Viết bằng tiếng Anh, ví dụ: Hello! How is your farm?" className="ui-input w-full text-sm" lang="en" spellCheck={false} />
              <div className="flex justify-between text-[11px] text-muted mt-0.5"><span>{words} từ</span><span>{text.length}/{maxLen}</span></div>
            </div>
            <div>
              <p className="text-[11px] font-bold text-muted uppercase mb-1">Mẫu câu gợi ý (bấm để điền)</p>
              <div className="flex flex-wrap gap-1.5">
                {(type === "ASK" ? [[askText(crop, n), `Nhờ bạn gửi ${n} ${catalog.crops[crop]?.name.toLowerCase()}`], [`I need ${n} ${enCrop(crop, n)} for an order. Can you help me?`, "Mình cần cho một đơn hàng, bạn giúp được không?"]] as [string, string][] : [...GREETINGS, ...REPLIES]).map(([en, vi]) => (
                  <button key={en} title={vi} onClick={() => { setText(en); setCheck(null); }} className="ui-chip text-xs">{en}</button>
                ))}
              </div>
            </div>
            {check && (
              <div className={`rounded-xl px-3 py-2.5 text-sm ${check.safe ? (check.ok ? "bg-emerald-50 text-emerald-900" : "bg-sky-50 text-sky-900") : "bg-red-50 text-red-800"}`}>
                {!check.safe ? <p>{check.tip || "Tin nhắn chưa phù hợp, hãy viết lại nhé."}</p> : (
                  <>
                    <p className="font-bold">{check.ok ? "Câu của bạn ổn rồi!" : "Gợi ý sửa:"}</p>
                    {!check.ok && check.corrected && <p className="mt-0.5 italic" lang="en">{check.corrected}</p>}
                    {check.tip && <p className="mt-1 text-xs">{check.tip}</p>}
                    {!check.ok && check.corrected && check.corrected !== text && <button onClick={() => { setText(check.corrected); setCheck(null); }} className="btn-outline rounded-full px-3 py-1 text-xs font-bold mt-2 bg-white">Dùng câu đã sửa</button>}
                  </>
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <button disabled={!text.trim() || words < 2 || busy !== ""} onClick={doCheck} className="btn-outline rounded-full px-5 py-2.5 font-bold disabled:opacity-40">{busy === "check" ? "Đang kiểm tra..." : box.aiOn ? "Kiểm tra bằng AI" : "Kiểm tra câu"}</button>
              <button disabled={!toId || words < 2 || busy !== "" || (check ? !check.safe : false)} onClick={doSend} className="btn-primary rounded-full px-6 py-2.5 font-bold disabled:opacity-40">{busy === "send" ? "Đang gửi..." : "Gửi thư"}</button>
              <span className="text-[11px] text-muted self-center">Hôm nay đã gửi {limits?.sent ?? 0}/{limits?.maxSend ?? 15} thư · 3 thư đầu mỗi ngày được thưởng xu</span>
            </div>
            <p className="text-[11px] text-muted">Không chia sẻ số điện thoại, email, liên kết hay mạng xã hội. Thư chứa lời lẽ không phù hợp sẽ bị chặn.</p>
          </div>
        )
      )}
    </Modal>
  );
}
