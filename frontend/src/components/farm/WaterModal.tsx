"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Modal from "./Modal";
import { farmApi, formatCountdown, type FarmState, type PlotView, type WaterQuiz } from "@/lib/farm/api";
import { liveStatus } from "./FarmScene";

// Tưới nước bằng kiến thức: gõ lại từ tiếng Anh theo nghĩa (từ ĐÃ HỌC khác, không phải từ của cây này).
// Mỗi lần đúng rút 10% thời gian còn lại của cây; chỉ là học thêm nên không ảnh hưởng lịch ôn của các từ được hỏi.
export default function WaterModal({ userId, plot, now, onClose, onState, onToast }: {
  userId: string; plot: PlotView; now: number; onClose: () => void; onState: (s: FarmState) => void; onToast: (m: string) => void;
}) {
  const [quiz, setQuiz] = useState<WaterQuiz | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [wrong, setWrong] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const live = liveStatus(plot, now);

  const load = useCallback(async () => {
    try { setQuiz(await farmApi.waterQuiz(userId, plot.id)); setIdx(0); setAnswer(""); setWrong(false); setErr(null); } catch (e: any) { setErr(e.message); }
  }, [userId, plot.id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { inputRef.current?.focus(); }, [quiz, idx]);

  const item = quiz?.items[idx];
  const submit = async () => {
    if (!item || busy || !answer.trim()) return; setBusy(true);
    try {
      const s = await farmApi.water(userId, plot.id, item.progressId, answer);
      if (s.ok === false) { setWrong(true); setAnswer(""); setIdx((i) => (quiz && i + 1 < quiz.items.length ? i + 1 : 0)); }
      else { onState(s); const w = s.watered; onToast(`💧 Tưới đúng! Cây rút ${w ? Math.max(1, Math.round(w.cutMs / 60000)) : 0} phút · +${w?.coins ?? 0} xu`); await load(); }
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <Modal title="💧 Tưới nước bằng kiến thức" subtitle={live.status === "READY" ? "Cây đã chín, đi thu hoạch thôi!" : `Cây chín sau ${formatCountdown(live.msLeft)}`} onClose={onClose}>
      {err && <div className="rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm font-semibold">{err}</div>}
      {!quiz && !err && <div className="py-8 text-center text-muted">Đang lấy nước...</div>}
      {quiz && (
        <div className="space-y-4">
          <p className="text-sm text-muted">Trả lời đúng 1 từ bạn đã học để rút {Math.round(quiz.cut * 100)}% thời gian còn lại. Hôm nay đã tưới <b className="text-foreground">{quiz.used}/{quiz.max}</b> lần.</p>
          {live.status === "READY" ? (
            <p className="rounded-2xl bg-emerald-50 px-4 py-4 text-emerald-800 font-semibold text-center">Cây đã chín, đóng cửa sổ này và bấm vào cây để thu hoạch nhé.</p>
          ) : quiz.left <= 0 ? (
            <p className="rounded-2xl bg-amber-50 px-4 py-4 text-amber-900 font-semibold text-center">Cây này đã được tưới đủ {quiz.max} lần hôm nay. Mai tưới tiếp, hoặc dùng Ôn sớm.</p>
          ) : !item ? (
            <p className="rounded-2xl bg-slate-50 px-4 py-4 text-muted text-center">Bạn chưa có từ nào đã học để làm nước tưới. Thu hoạch vài cây trước rồi quay lại nhé.</p>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-3">
              <div className="rounded-2xl bg-primary-soft px-4 py-3 text-center">
                <p className="text-xs uppercase tracking-wide text-muted font-bold">Nghĩa</p>
                <p className="text-2xl font-extrabold text-primary leading-tight">{item.meaning}</p>
                <p className="mt-2 font-mono text-lg tracking-widest text-primary">{item.hint}</p>
              </div>
              <input ref={inputRef} value={answer} onChange={(e) => { setAnswer(e.target.value); setWrong(false); }} placeholder="Gõ từ tiếng Anh..." autoComplete="off" autoCapitalize="off" spellCheck={false} className="ui-input w-full text-lg font-bold" />
              {wrong && <p className="text-sm font-semibold text-amber-800 text-center">Chưa đúng, thử từ tiếp theo nhé.</p>}
              <button type="submit" disabled={busy || !answer.trim()} className="btn-primary rounded-full px-6 py-2.5 font-bold w-full disabled:opacity-50">{busy ? "Đang chấm..." : "Tưới"}</button>
            </form>
          )}
        </div>
      )}
    </Modal>
  );
}
