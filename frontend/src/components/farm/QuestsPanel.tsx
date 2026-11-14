"use client";
import { useEffect, useMemo, useState } from "react";
import Modal from "./Modal";
import { alert as swalAlert } from "./farmSwal";
import { CoinIcon, GemIcon, IconBolt, IconCheck, IconGift, NamedIcon } from "./FarmIcons";
import { farmApi, type AchGroup, type FarmState, type QuestsView, type AchievementsView, type Reward } from "@/lib/farm/api";

// Nhiệm vụ hằng ngày (4 việc + rương thưởng khi nhận đủ) và Thành tựu (13 chuỗi mốc, nhận từng chuỗi).
// Mục tiêu nhiệm vụ chốt theo cấp lúc đầu ngày; tiến độ do server tính, client chỉ hiển thị + bấm nhận.
function RewardChips({ r }: { r: { coins?: number; gems?: number; xp?: number } }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {!!r.coins && <span className="farm-chip-reward"><CoinIcon size={15} />+{r.coins}</span>}
      {!!r.gems && <span className="farm-chip-reward"><GemIcon size={15} />+{r.gems}</span>}
      {!!r.xp && <span className="farm-chip-reward"><IconBolt size={14} className="text-primary" />+{r.xp} XP</span>}
    </div>
  );
}
function Bar({ pct, tone = "bg-primary" }: { pct: number; tone?: string }) {
  return <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden"><div className={`h-full rounded-full transition-all duration-500 ${tone}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} /></div>;
}
const fmtLeft = (ms: number) => { if (ms <= 0) return "sắp làm mới"; const m = Math.floor(ms / 60000); const h = Math.floor(m / 60); return h > 0 ? `${h} giờ ${m % 60} phút` : `${m} phút`; };

export default function QuestsPanel({ userId, quests, achievements, onClose, onState, initialTab = "DAILY" }: {
  userId: string; quests: QuestsView; achievements: AchievementsView; onClose: () => void; onState: (s: FarmState) => void; initialTab?: "DAILY" | "ACH";
}) {
  const [tab, setTab] = useState<"DAILY" | "ACH">(initialTab);
  const [busy, setBusy] = useState<string | null>(null);
  const [left, setLeft] = useState(() => new Date(quests.resetAt).getTime() - Date.now());
  useEffect(() => { const t = setInterval(() => setLeft(new Date(quests.resetAt).getTime() - Date.now()), 30000); setLeft(new Date(quests.resetAt).getTime() - Date.now()); return () => clearInterval(t); }, [quests.resetAt]);

  const claimQ = async (id: string) => {
    if (busy) return; setBusy(id);
    try { onState(await farmApi.claimQuest(userId, id)); } catch (e: any) { swalAlert("", e.message, "info"); }
    setBusy(null);
  };
  const claimA = async (g: AchGroup) => {
    if (busy) return; setBusy(g.id);
    try { onState(await farmApi.claimAchievement(userId, g.id)); } catch (e: any) { swalAlert("", e.message, "info"); }
    setBusy(null);
  };

  const doneCount = quests.items.filter((i) => i.claimed).length;
  // Thành tựu: nhận được lên đầu, sau đó chuỗi đang tiến gần mốc kế, cuối cùng chuỗi đã hoàn thành
  const groups = useMemo(() => {
    const ratio = (g: AchGroup) => { const nx = g.tiers.find((t) => !t.reached); return nx ? g.value / nx.target : 2; };
    return [...achievements.groups].sort((a, b) => (b.claimable > 0 ? 1 : 0) - (a.claimable > 0 ? 1 : 0) || Number(a.complete) - Number(b.complete) || ratio(b) - ratio(a));
  }, [achievements.groups]);

  return (
    <Modal title="Nhiệm vụ" subtitle={tab === "DAILY" ? `Làm mới sau ${fmtLeft(left)}` : `${achievements.completed}/${achievements.total} mốc đã nhận`} onClose={onClose} wide>
      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => setTab("DAILY")} className={`ui-chip inline-flex items-center gap-1.5 ${tab === "DAILY" ? "ui-chip-active" : ""}`}>Hằng ngày {quests.claimable > 0 && <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[11px] font-black inline-flex items-center justify-center">{quests.claimable}</span>}</button>
        <button onClick={() => setTab("ACH")} className={`ui-chip inline-flex items-center gap-1.5 ${tab === "ACH" ? "ui-chip-active" : ""}`}>Thành tựu {achievements.claimable > 0 && <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[11px] font-black inline-flex items-center justify-center">{achievements.claimable}</span>}</button>
      </div>

      {tab === "DAILY" && (
        <div className="space-y-3">
          <div className="rounded-2xl bg-primary-soft px-4 py-3">
            <div className="flex justify-between text-sm font-extrabold text-primary"><span>Tiến độ hôm nay</span><span>{doneCount}/{quests.items.length} nhiệm vụ đã nhận</span></div>
            <div className="mt-2"><Bar pct={(doneCount / quests.items.length) * 100} /></div>
          </div>

          {quests.items.map((q) => {
            const pct = (q.progress / q.target) * 100;
            const ready = q.done && !q.claimed;
            return (
              <div key={q.id} className={`rounded-2xl border bg-white p-3.5 flex items-center gap-3 ${ready ? "farm-glow-card border-transparent" : "border-line"}`}>
                <div className={`farm-ring ${q.claimed ? "farm-ring-done" : ready ? "farm-ring-gold" : ""}`}>{q.claimed ? <IconCheck size={22} /> : <NamedIcon name={q.icon} size={22} />}</div>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className={`font-extrabold leading-tight ${q.claimed ? "text-muted line-through" : "text-foreground"}`}>{q.label}</p>
                    <span className="text-xs font-bold text-muted shrink-0">{q.progress}/{q.target}</span>
                  </div>
                  <Bar pct={pct} tone={q.done ? "bg-emerald-500" : "bg-primary"} />
                  <RewardChips r={q.reward} />
                </div>
                <button onClick={() => claimQ(q.id)} disabled={!ready || busy === q.id} className={`rounded-full px-4 py-2 text-sm font-bold shrink-0 ${ready ? "btn-highlight" : q.claimed ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "btn-outline opacity-50"}`}>
                  {q.claimed ? "Đã nhận" : ready ? (busy === q.id ? "..." : "Nhận") : "Chưa xong"}
                </button>
              </div>
            );
          })}

          <div className={`rounded-2xl border p-4 flex items-center gap-4 ${quests.chest.ready ? "farm-glow-card border-transparent bg-amber-50" : "border-line bg-white"}`}>
            <div className={`farm-ring ${quests.chest.claimed ? "farm-ring-done" : "farm-ring-gold"} !w-14 !h-14 ${quests.chest.ready ? "farm-chest-ready" : ""}`}><IconGift size={28} /></div>
            <div className="flex-1 min-w-0 space-y-1.5">
              <p className="font-extrabold text-foreground">Rương nhiệm vụ</p>
              <p className="text-xs text-muted">Nhận đủ {quests.chest.total} nhiệm vụ để mở rương ({quests.chest.progress}/{quests.chest.total})</p>
              <RewardChips r={quests.chest.reward} />
            </div>
            <button onClick={() => claimQ("CHEST")} disabled={!quests.chest.ready || busy === "CHEST"} className={`rounded-full px-4 py-2.5 text-sm font-bold shrink-0 ${quests.chest.ready ? "btn-highlight" : quests.chest.claimed ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "btn-outline opacity-50"}`}>
              {quests.chest.claimed ? "Đã mở" : quests.chest.ready ? (busy === "CHEST" ? "..." : "Mở rương") : "Còn khoá"}
            </button>
          </div>
        </div>
      )}

      {tab === "ACH" && (
        <div className="grid gap-3 sm:grid-cols-2">
          {groups.map((g) => {
            const next = g.tiers.find((t) => !t.reached);
            const pct = next ? (g.value / next.target) * 100 : 100;
            const reward = g.tiers.filter((t) => t.reached && !t.claimed).reduce((a, t) => ({ coins: a.coins + t.reward.coins, gems: a.gems + t.reward.gems }), { coins: 0, gems: 0 });
            return (
              <div key={g.id} className={`rounded-2xl border bg-white p-3.5 space-y-2.5 ${g.claimable ? "farm-glow-card border-transparent" : "border-line"}`}>
                <div className="flex items-center gap-3">
                  <div className={`farm-ring ${g.complete ? "farm-ring-done" : g.claimable ? "farm-ring-gold" : ""}`}><NamedIcon name={g.icon} size={22} /></div>
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold text-foreground leading-tight">{g.name}</p>
                    <p className="text-xs text-muted leading-snug">{g.desc}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {g.tiers.map((t, i) => <span key={i} title={`Mốc ${t.target}`} className={`farm-tier-dot ${t.claimed ? "farm-tier-dot-claimed" : t.reached ? "farm-tier-dot-reached" : ""}`} />)}
                  <span className="ml-auto text-xs font-bold text-muted">{g.complete ? "Hoàn thành" : `${g.value}/${next?.target}`}</span>
                </div>
                {!g.complete && <Bar pct={pct} tone={g.claimable ? "bg-amber-500" : "bg-primary"} />}
                {g.claimable > 0 ? (
                  <button onClick={() => claimA(g)} disabled={busy === g.id} className="btn-highlight rounded-full w-full py-2 text-sm font-bold inline-flex items-center justify-center gap-2">
                    {busy === g.id ? "..." : <>Nhận {reward.coins > 0 && <span className="inline-flex items-center gap-1"><CoinIcon size={15} />{reward.coins}</span>}{reward.gems > 0 && <span className="inline-flex items-center gap-1"><GemIcon size={15} />{reward.gems}</span>}</>}
                  </button>
                ) : next ? (
                  <div className="flex items-center justify-between text-xs text-muted"><span>Mốc tiếp theo: {next.target}</span><RewardChips r={next.reward} /></div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
export type { Reward };
