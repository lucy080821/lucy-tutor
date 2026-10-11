"use client";
import { useState } from "react";
import {
  LISTENING_BAND_TABLE, READING_BAND_TABLE_ACADEMIC, READING_BAND_TABLE_GT,
  rawScoreToBand, roundIeltsBand, fmtBand,
} from "@/lib/tools/ieltsBand";

const BAND_OPTIONS = Array.from({ length: 19 }, (_, i) => i * 0.5); // 0 → 9

type Mode = "RAW" | "BAND";

function clampRaw(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Math.floor(Number(v));
  if (Number.isNaN(n)) return null;
  return Math.min(40, Math.max(0, n));
}

function RawOrBand({ label, mode, setMode, raw, setRaw, band, setBand, computed }: {
  label: string; mode: Mode; setMode: (m: Mode) => void;
  raw: string; setRaw: (v: string) => void; band: string; setBand: (v: string) => void; computed: number | null;
}) {
  return (
    <div className="rounded-2xl border border-line p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold text-primary text-lg">{label}</h3>
        <div className="flex gap-1">
          <button onClick={() => setMode("RAW")} className={`ui-chip cursor-pointer text-xs ${mode === "RAW" ? "ui-chip-active" : ""}`}>Số câu đúng</button>
          <button onClick={() => setMode("BAND")} className={`ui-chip cursor-pointer text-xs ${mode === "BAND" ? "ui-chip-active" : ""}`}>Đã có band</button>
        </div>
      </div>
      {mode === "RAW" ? (
        <div className="mt-3 flex items-end gap-3">
          <label className="flex-1">
            <span className="ui-label">Số câu đúng (0–40)</span>
            <input type="number" inputMode="numeric" min={0} max={40} value={raw} onChange={(e) => setRaw(e.target.value)} className="ui-input w-full mt-1" placeholder="Ví dụ: 30" />
          </label>
          <div className="text-right shrink-0 pb-1">
            <span className="block text-xs text-muted">Band</span>
            <span className="text-3xl font-extrabold text-primary">{computed === null ? "–" : fmtBand(computed)}</span>
          </div>
        </div>
      ) : (
        <label className="block mt-3">
          <span className="ui-label">Band {label}</span>
          <select value={band} onChange={(e) => setBand(e.target.value)} className="ui-input w-full mt-1">
            <option value="">Chọn band</option>
            {BAND_OPTIONS.map((b) => <option key={b} value={b}>{fmtBand(b)}</option>)}
          </select>
        </label>
      )}
    </div>
  );
}

function BandSelect({ label, hint, value, setValue }: { label: string; hint: string; value: string; setValue: (v: string) => void }) {
  return (
    <div className="rounded-2xl border border-line p-4 sm:p-5">
      <h3 className="font-bold text-primary text-lg">{label}</h3>
      <p className="text-xs text-muted mt-1">{hint}</p>
      <select value={value} onChange={(e) => setValue(e.target.value)} className="ui-input w-full mt-3" aria-label={`Band ${label}`}>
        <option value="">Chọn band</option>
        {BAND_OPTIONS.map((b) => <option key={b} value={b}>{fmtBand(b)}</option>)}
      </select>
    </div>
  );
}

export default function IeltsBandCalculator() {
  const [testType, setTestType] = useState<"ACADEMIC" | "GT">("ACADEMIC");
  const [lMode, setLMode] = useState<Mode>("RAW");
  const [rMode, setRMode] = useState<Mode>("RAW");
  const [lRaw, setLRaw] = useState("");
  const [rRaw, setRRaw] = useState("");
  const [lBandSel, setLBandSel] = useState("");
  const [rBandSel, setRBandSel] = useState("");
  const [w, setW] = useState("");
  const [s, setS] = useState("");

  const lRawN = clampRaw(lRaw);
  const rRawN = clampRaw(rRaw);
  const lComputed = lRawN === null ? null : rawScoreToBand(lRawN, LISTENING_BAND_TABLE);
  const rComputed = rRawN === null ? null : rawScoreToBand(rRawN, testType === "GT" ? READING_BAND_TABLE_GT : READING_BAND_TABLE_ACADEMIC);

  const lBand = lMode === "RAW" ? lComputed : lBandSel === "" ? null : Number(lBandSel);
  const rBand = rMode === "RAW" ? rComputed : rBandSel === "" ? null : Number(rBandSel);
  const wBand = w === "" ? null : Number(w);
  const sBand = s === "" ? null : Number(s);
  const all = [lBand, rBand, wBand, sBand];
  const ready = all.every((b) => b !== null);
  const avg = ready ? (all as number[]).reduce((a, b) => a + b, 0) / 4 : null;
  const overall = avg === null ? null : roundIeltsBand(avg);

  return (
    <div className="ui-card p-5 sm:p-8">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-muted mr-1">Loại bài thi:</span>
        <button onClick={() => setTestType("ACADEMIC")} className={`ui-chip cursor-pointer ${testType === "ACADEMIC" ? "ui-chip-active" : ""}`}>Academic</button>
        <button onClick={() => setTestType("GT")} className={`ui-chip cursor-pointer ${testType === "GT" ? "ui-chip-active" : ""}`}>General Training</button>
      </div>

      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        <RawOrBand label="Listening" mode={lMode} setMode={setLMode} raw={lRaw} setRaw={setLRaw} band={lBandSel} setBand={setLBandSel} computed={lComputed} />
        <RawOrBand label="Reading" mode={rMode} setMode={setRMode} raw={rRaw} setRaw={setRRaw} band={rBandSel} setBand={setRBandSel} computed={rComputed} />
        <BandSelect label="Writing" hint="Band Writing do giám khảo chấm (Task 2 chiếm gấp đôi Task 1)." value={w} setValue={setW} />
        <BandSelect label="Speaking" hint="Band Speaking do giám khảo chấm theo 4 tiêu chí." value={s} setValue={setS} />
      </div>

      <div className="mt-6 rounded-2xl bg-primary-soft p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted">Band Overall ước tính</p>
          <p className="text-5xl font-extrabold text-primary mt-1">{overall === null ? "–" : fmtBand(overall)}</p>
        </div>
        <div className="text-sm text-muted sm:text-right">
          {ready && avg !== null ? (
            <>
              <p>Trung bình: ({all.map((b) => fmtBand(b as number)).join(" + ")}) ÷ 4 = <b className="text-foreground">{avg.toFixed(3).replace(/\.?0+$/, "")}</b></p>
              <p className="mt-1">Làm tròn theo quy tắc IELTS → <b className="text-primary">{fmtBand(overall as number)}</b></p>
            </>
          ) : (
            <p>Nhập đủ 4 kỹ năng để tính band Overall.</p>
          )}
        </div>
      </div>
      <p className="mt-3 text-xs text-muted">
        Bảng quy đổi dùng số liệu phổ biến trong tài liệu luyện thi. IELTS không công bố một bảng chung cho mọi đề — mỗi đề thật có thể lệch khoảng ±1 câu ở ngưỡng band, vì vậy kết quả chỉ là ước tính.
      </p>
    </div>
  );
}
