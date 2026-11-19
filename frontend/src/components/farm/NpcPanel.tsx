"use client";
import { useEffect, useRef, useState } from "react";
import Modal from "./Modal";
import { farmApi, type Catalog, type FarmState, type NpcState } from "@/lib/farm/api";

// Trò chuyện với khách ghé nông trại bằng tiếng Anh (AI đóng vai): mỗi khách có 1 nhiệm vụ nói; làm xong được thưởng,
// thương nhân còn mua nông sản giá cao hơn Kho. AI sửa lỗi câu của bạn và đưa mẹo tiếng Việt sau mỗi lượt.
const enCrop = (key: string, n: number) => (n === 1 ? key : key === "strawberry" ? "strawberries" : key === "tomato" ? "tomatoes" : `${key}s`);
type Line = { who: "me" | "npc"; text: string; correction?: string; tip?: string };
const STARTERS: Record<string, [string, string][]> = {
  merchant: [["I can sell you {n} {crop}.", "Tôi bán cho ông số cà rốt..."], ["How much do you pay for them?", "Ông trả giá bao nhiêu?"], ["Yes, we have fresh {crop} today.", "Vâng, hôm nay có hàng tươi"]],
  grandma: [["I grow carrots and tomatoes.", "Tôi trồng cà rốt và cà chua"], ["I like my farm because it is quiet.", "Tôi thích nông trại vì nó yên tĩnh"], ["My pet dragon helps me every day.", "Rồng của tôi giúp tôi mỗi ngày"]],
  traveler: [["Go straight, then turn left.", "Đi thẳng rồi rẽ trái"], ["The market is next to the bridge.", "Chợ ở cạnh cây cầu"], ["It is not far from here.", "Không xa đây đâu"]],
  kid: [["Its name is Qilin.", "Tên nó là Qilin"], ["It is blue and very friendly.", "Nó màu xanh và rất thân thiện"], ["It helps me learn English.", "Nó giúp tôi học tiếng Anh"]],
  trucker: [["I can sell you {n} {crop}.", "Tôi bán cho ông số cà rốt..."], ["Is thirty coins a good price?", "30 xu là giá tốt chứ?"], ["They are fresh from the farm.", "Chúng tươi từ nông trại"]],
  peddler: [["How much are the {crop}?", "{crop} bao nhiêu tiền vậy?"], ["I would like to buy some, please.", "Cho tôi mua một ít nhé"], ["Are they fresh?", "Chúng có tươi không?"]],
  teacher: [["My name is Nam and I am ten years old.", "Tên em là Nam, em mười tuổi"], ["I live in a small village.", "Em sống ở một ngôi làng nhỏ"], ["I like English because it is fun.", "Em thích tiếng Anh vì nó vui"]],
  waiter: [["I would like a bowl of soup, please.", "Cho tôi một bát súp"], ["Can I have a glass of orange juice?", "Cho tôi một ly nước cam"], ["How much is it?", "Bao nhiêu tiền?"]],
};

export default function NpcPanel({ userId, npc, inventory, catalog, onClose, onState, onToast, venue, onNpc, coins }: {
  venue?: string; onNpc?: (n: NpcState) => void; coins?: number; userId: string; npc: NpcState; inventory: Record<string, number>; catalog: Catalog; onClose: () => void; onState: (s: FarmState) => void; onToast: (m: string) => void;
}) {
  const [log, setLog] = useState<Line[]>([{ who: "npc", text: npc.greeting }]);
  const [text, setText] = useState(""); const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setLog([{ who: "npc", text: npc.greeting }]); }, [npc.key]); // khách mới → cuộc trò chuyện mới
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [log.length]);

  const left = Math.min(npc.turnsMax - npc.turns, npc.turnsTodayMax - npc.turnsToday);
  const have = npc.wants ? inventory[npc.wants.crop] || 0 : 0;
  const send = async () => {
    const msg = text.trim(); if (!msg || busy || left <= 0) return;
    setBusy(true);
    try {
      const history = log.slice(-6).map((l) => ({ who: l.who, text: l.text }));
      const s = await farmApi.npcTalk(userId, msg, history, venue); if (s.venueNpc) onNpc?.(s.venueNpc);
      const r = s.npcReply!;
      setLog((l) => [...l, { who: "me", text: msg, correction: r.correction && r.correction.toLowerCase() !== msg.toLowerCase() ? r.correction : "", tip: r.tip }, { who: "npc", text: r.reply }]);
      setText(""); onState(s);
      if (r.reward) onToast(`Hoàn thành nhiệm vụ: +${r.reward.coins} xu${r.reward.gems ? ` +${r.reward.gems} kim cương` : ""} +${r.reward.xp} XP`);
    } catch (e: any) { onToast(e.message); } finally { setBusy(false); }
  };
  const trade = async () => {
    setBusy(true);
    try { const s = await farmApi.npcTrade(userId); onState(s); onToast(`Đã bán ${s.npcTrade?.n} ${enCrop(s.npcTrade?.crop || "", s.npcTrade?.n || 1)}: +${s.npcTrade?.coins} xu`); setLog((l) => [...l, { who: "npc", text: "Thank you! That is a fair deal. See you next time!" }]); } catch (e: any) { onToast(e.message); } finally { setBusy(false); }
  };
  const buy = async () => {
    setBusy(true);
    try { const s = await farmApi.npcBuy(userId); onState(s); onToast(`Đã mua ${s.npcBuy?.n} ${enCrop(s.npcBuy?.crop || "", s.npcBuy?.n || 1)}: −${s.npcBuy?.price} xu`); setLog((l) => [...l, { who: "npc", text: "Thank you! Enjoy your fresh vegetables!" }]); } catch (e: any) { onToast(e.message); } finally { setBusy(false); }
  };
  const item = npc.wants || npc.offer;
  const fill = (s: string) => item ? s.replace("{n}", String(item.n)).replace("{crop}", enCrop(item.crop, item.n)) : s;
  const until = new Date(npc.endsAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  const sub = venue ? `${npc.role} · phiên hôm nay (1 nhiệm vụ/ngày)` : `${npc.role} · ở lại đến ${until}`;

  return (
    <Modal title={npc.name} subtitle={sub} onClose={onClose}>
      <div className={`rounded-xl px-3 py-2.5 text-sm ${npc.goalDone ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"}`}>
        <p className="font-bold">{npc.goalDone ? "Nhiệm vụ đã xong" : "Nhiệm vụ nói chuyện"}</p>
        <p className="text-xs mt-0.5">{npc.goalVi}{!npc.goalDone && ` · Thưởng ${npc.reward.coins}+ xu, ${npc.reward.xp} XP${npc.reward.gems ? `, ${npc.reward.gems} kim cương` : ""}`}</p>
      </div>
      {npc.wants && (
        <div className="mt-2 rounded-xl border border-line px-3 py-2 text-sm flex flex-wrap items-center justify-between gap-2">
          <p>{npc.name} muốn mua <b>{npc.wants.n} {catalog.crops[npc.wants.crop]?.emoji} {catalog.crops[npc.wants.crop]?.name.toLowerCase()}</b> <span className="text-muted">({enCrop(npc.wants.crop, npc.wants.n)})</span> giá <b>{npc.price} xu</b> (cao hơn giá Kho). Kho: {have}/{npc.wants.n}.</p>
          {npc.traded ? <span className="ui-badge bg-emerald-100 text-emerald-800">Đã bán</span> : <button disabled={busy || !npc.goalDone || have < npc.wants.n} onClick={trade} className="btn-primary rounded-full px-4 py-1.5 text-xs font-bold disabled:opacity-40" title={!npc.goalDone ? "Hãy đề nghị bán bằng tiếng Anh trước" : ""}>{npc.goalDone ? "Bán" : "Hãy nói trước"}</button>}
        </div>
      )}
      {npc.offer && (
        <div className="mt-2 rounded-xl border border-line px-3 py-2 text-sm flex flex-wrap items-center justify-between gap-2">
          <p>Xe đang bán <b>{npc.offer.n} {catalog.crops[npc.offer.crop]?.emoji} {catalog.crops[npc.offer.crop]?.name.toLowerCase()}</b> <span className="text-muted">({enCrop(npc.offer.crop, npc.offer.n)})</span> giá <b>{npc.price} xu</b>. Bạn có {coins ?? "?"} xu.</p>
          {npc.traded ? <span className="ui-badge bg-emerald-100 text-emerald-800">Đã mua</span> : <button disabled={busy || !npc.goalDone || (coins ?? 0) < (npc.price || 0)} onClick={buy} className="btn-primary rounded-full px-4 py-1.5 text-xs font-bold disabled:opacity-40" title={!npc.goalDone ? "Hãy hỏi giá bằng tiếng Anh trước" : ""}>{npc.goalDone ? "Mua hàng" : "Hãy hỏi giá trước"}</button>}
        </div>
      )}
      <div className="mt-3 space-y-2 max-h-[40vh] overflow-y-auto pr-1">
        {log.map((l, i) => (
          <div key={i} className={`flex ${l.who === "me" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${l.who === "me" ? "bg-primary text-white" : "bg-slate-100 text-foreground"}`}>
              <p lang="en">{l.text}</p>
              {l.who === "me" && (l.correction || l.tip) && (
                <div className="mt-1.5 rounded-lg bg-white/95 text-slate-800 px-2 py-1.5 text-xs">
                  {l.correction && <p>Nên viết: <i lang="en">{l.correction}</i></p>}
                  {l.tip && <p className="text-slate-600">{l.tip}</p>}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {(STARTERS[npc.kind] || []).map(([en, vi]) => <button key={en} title={vi} onClick={() => setText(fill(en))} className="ui-chip text-xs">{fill(en)}</button>)}
      </div>
      <div className="mt-2 flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value.slice(0, catalog.mail.maxLen))} onKeyDown={(e) => { if (e.key === "Enter") send(); }} disabled={left <= 0} placeholder={left > 0 ? "Trả lời bằng tiếng Anh..." : venue ? "Hôm nay bạn đã luyện đủ ở đây rồi" : "Khách đã nói chuyện đủ rồi"} className="ui-input flex-1 text-sm" lang="en" spellCheck={false} />
        <button onClick={send} disabled={busy || !text.trim() || left <= 0} className="btn-primary rounded-full px-5 font-bold disabled:opacity-40">{busy ? "..." : "Gửi"}</button>
      </div>
      <p className="text-[11px] text-muted mt-1.5">Lượt nói: {npc.turns}/{npc.turnsMax} (hôm nay {npc.turnsToday}/{npc.turnsTodayMax}). Không chia sẻ thông tin cá nhân nhé.</p>
    </Modal>
  );
}
