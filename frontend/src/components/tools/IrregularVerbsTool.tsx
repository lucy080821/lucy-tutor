"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { IRREGULAR_VERBS, matchForm, normalizeVi, type IrregularVerb } from "@/lib/tools/irregularVerbs";

const ROWS_PER_PDF_PAGE = 32;
const QUIZ_LEN = 10;

function speak(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/\//g, ", "));
  u.lang = "en-US";
  u.rate = 0.85;
  window.speechSynthesis.speak(u);
}

function PdfPage({ verbs, page, pages, title }: { verbs: IrregularVerb[]; page: number; pages: number; title: string }) {
  const cell = { padding: "6px 10px", borderBottom: "1px solid #e2e8f0", fontSize: 15 } as const;
  return (
    <div data-pdf-page style={{ width: 800, height: 1131, padding: "36px 40px", boxSizing: "border-box", background: "#fff", fontFamily: "Calibri, Arial, sans-serif", color: "#0f172a" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "2px solid #1E3A8A", paddingBottom: 8, marginBottom: 12 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#1E3A8A" }}>{title}</div>
        <div style={{ fontSize: 12, color: "#64748b", textAlign: "right" }}>lucytutor.online<br />Trang {page}/{pages}</div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#eef2fb", color: "#1E3A8A", textAlign: "left" }}>
            <th style={{ ...cell, fontSize: 13 }}>V1 (Nguyên mẫu)</th>
            <th style={{ ...cell, fontSize: 13 }}>V2 (Quá khứ)</th>
            <th style={{ ...cell, fontSize: 13 }}>V3 (Quá khứ phân từ)</th>
            <th style={{ ...cell, fontSize: 13 }}>Nghĩa</th>
          </tr>
        </thead>
        <tbody>
          {verbs.map((v) => (
            <tr key={v.v1}>
              <td style={{ ...cell, fontWeight: 700, color: "#1E3A8A" }}>{v.v1}</td>
              <td style={cell}>{v.v2}</td>
              <td style={cell}>{v.v3}</td>
              <td style={{ ...cell, fontSize: 14 }}>{v.vi}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type QuizItem = { verb: IrregularVerb; v2: string; v3: string; checked: boolean };

export default function IrregularVerbsTool() {
  const [mode, setMode] = useState<"TABLE" | "QUIZ">("TABLE");
  const [query, setQuery] = useState("");
  const [onlyCommon, setOnlyCommon] = useState(false);
  const [pdfVerbs, setPdfVerbs] = useState<IrregularVerb[] | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const commonCount = IRREGULAR_VERBS.filter((v) => v.common).length;
  const filtered = useMemo(() => {
    const q = normalizeVi(query.trim());
    return IRREGULAR_VERBS.filter((v) => (!onlyCommon || v.common) &&
      (!q || [v.v1, v.v2, v.v3].some((f) => f.toLowerCase().includes(q)) || normalizeVi(v.vi).includes(q)));
  }, [query, onlyCommon]);

  // PDF: render các trang ẩn ngoài màn hình rồi chụp từng trang (giống flashcard)
  useEffect(() => {
    if (!pdfVerbs || !printRef.current) return;
    let cancelled = false;
    (async () => {
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      const nodes = Array.from(printRef.current?.querySelectorAll<HTMLElement>("[data-pdf-page]") ?? []);
      try {
        const { exportPagesToPDF } = await import("@/lib/pdfExport");
        if (!cancelled) await exportPagesToPDF(nodes, onlyCommon ? "bang-dong-tu-bat-quy-tac-thong-dung.pdf" : "bang-dong-tu-bat-quy-tac.pdf");
      } finally {
        if (!cancelled) setPdfVerbs(null);
      }
    })();
    return () => { cancelled = true; };
  }, [pdfVerbs, onlyCommon]);

  // ── Luyện tập ──
  const [quiz, setQuiz] = useState<QuizItem[] | null>(null);
  const [qIdx, setQIdx] = useState(0);
  const startQuiz = () => {
    const pool = IRREGULAR_VERBS.filter((v) => !onlyCommon || v.common);
    const a = [...pool];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    setQuiz(a.slice(0, QUIZ_LEN).map((verb) => ({ verb, v2: "", v3: "", checked: false })));
    setQIdx(0);
  };
  const cur = quiz?.[qIdx];
  const setCur = (patch: Partial<QuizItem>) => setQuiz((qs) => qs && qs.map((q, i) => (i === qIdx ? { ...q, ...patch } : q)));
  const score = quiz ? quiz.filter((q) => q.checked && matchForm(q.v2, q.verb.v2) && matchForm(q.v3, q.verb.v3)).length : 0;

  return (
    <div className="ui-card p-5 sm:p-8">
      <div className="flex flex-wrap items-center gap-2" role="tablist">
        <button role="tab" aria-selected={mode === "TABLE"} onClick={() => setMode("TABLE")} className={`ui-chip cursor-pointer ${mode === "TABLE" ? "ui-chip-active" : ""}`}>Bảng tra V1 – V2 – V3</button>
        <button role="tab" aria-selected={mode === "QUIZ"} onClick={() => setMode("QUIZ")} className={`ui-chip cursor-pointer ${mode === "QUIZ" ? "ui-chip-active" : ""}`}>Luyện tập</button>
        <label className="ml-auto flex items-center gap-2 text-sm text-muted cursor-pointer select-none">
          <input type="checkbox" checked={onlyCommon} onChange={(e) => setOnlyCommon(e.target.checked)} className="w-4 h-4 accent-[#1E3A8A]" />
          Chỉ động từ thông dụng ({commonCount})
        </label>
      </div>

      {mode === "TABLE" ? (
        <>
          <div className="mt-5 flex flex-col sm:flex-row gap-3">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm theo V1, V2, V3 hoặc nghĩa (vd: go, went, viết)..."
              className="ui-input flex-1" aria-label="Tìm động từ bất quy tắc" autoComplete="off" spellCheck={false} />
            <button onClick={() => setPdfVerbs(filtered)} disabled={!!pdfVerbs || filtered.length === 0} className="btn-primary px-5 py-3 disabled:opacity-50">
              {pdfVerbs ? "Đang tạo PDF..." : "Tải bảng PDF"}
            </button>
          </div>
          <p className="mt-3 text-sm text-muted">Hiển thị <b className="text-foreground">{filtered.length}</b> động từ</p>
          <div className="mt-3 overflow-x-auto">
            <table className="ui-table w-full text-sm">
              <thead><tr><th>V1 (Nguyên mẫu)</th><th>V2 (Quá khứ)</th><th>V3 (Quá khứ phân từ)</th><th>Nghĩa</th></tr></thead>
              <tbody>
                {filtered.map((v) => (
                  <tr key={v.v1}>
                    <td>
                      <span className="flex items-center gap-2">
                        <button onClick={() => speak(`${v.v1}, ${v.v2}, ${v.v3}`)} aria-label={`Nghe ${v.v1} ${v.v2} ${v.v3}`} title="Nghe 3 dạng"
                          className="w-8 h-8 shrink-0 rounded-full bg-primary-soft text-primary flex items-center justify-center hover:bg-primary hover:text-white transition-colors">
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
                        </button>
                        <b className="text-primary">{v.v1}</b>
                      </span>
                    </td>
                    <td>{v.v2}</td>
                    <td>{v.v3}</td>
                    <td className="text-muted">{v.vi}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : !quiz ? (
        <div className="mt-6">
          <p className="text-muted">Mỗi lượt 10 động từ ngẫu nhiên: nhìn V1 và nghĩa, gõ dạng quá khứ (V2) và quá khứ phân từ (V3). Động từ có 2 cách viết (learnt/learned) chấp nhận cả hai.</p>
          <button onClick={startQuiz} className="btn-primary mt-5 px-6 py-3">Bắt đầu luyện 10 động từ</button>
        </div>
      ) : qIdx >= quiz.length ? (
        <div className="mt-6 text-center">
          <p className="text-4xl font-extrabold text-primary">{score}/{quiz.length}</p>
          <p className="text-muted mt-1">{score >= 9 ? "Xuất sắc!" : score >= 6 ? "Khá tốt, ôn lại các từ sai bên dưới nhé." : "Ôn lại bảng rồi luyện tiếp nhé."}</p>
          <ul className="mt-4 text-sm text-left max-w-md mx-auto space-y-1">
            {quiz.filter((q) => !(matchForm(q.v2, q.verb.v2) && matchForm(q.v3, q.verb.v3))).map((q) => (
              <li key={q.verb.v1} className="text-red-700">✗ {q.verb.v1} – <b>{q.verb.v2}</b> – <b>{q.verb.v3}</b></li>
            ))}
          </ul>
          <button onClick={startQuiz} className="btn-primary mt-5 px-6 py-3">Luyện lượt mới</button>
        </div>
      ) : cur && (
        <div className="mt-6">
          <p className="text-sm text-muted">Câu {qIdx + 1}/{quiz.length} · Đúng {score}</p>
          <p className="mt-2 text-3xl font-extrabold text-primary">{cur.verb.v1} <span className="text-base font-normal text-muted">({cur.verb.vi})</span></p>
          <form className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); if (!cur.checked) setCur({ checked: true }); else setQIdx((i) => i + 1); }}>
            {(["v2", "v3"] as const).map((k) => {
              const ok = matchForm(cur[k], cur.verb[k]);
              return (
                <label key={k} className="block">
                  <span className="ui-label">{k === "v2" ? "V2 — Quá khứ đơn" : "V3 — Quá khứ phân từ"}</span>
                  <input value={cur[k]} onChange={(e) => setCur({ [k]: e.target.value })} disabled={cur.checked} autoComplete="off" spellCheck={false}
                    className={`ui-input w-full mt-1 ${cur.checked ? (ok ? "border-emerald-500 bg-emerald-50" : "border-red-400 bg-red-50") : ""}`} />
                  {cur.checked && !ok && <span className="text-sm text-red-700">Đáp án: <b>{cur.verb[k]}</b></span>}
                </label>
              );
            })}
            <div className="sm:col-span-2 flex flex-wrap gap-3">
              <button type="submit" className="btn-primary px-6 py-2.5">{cur.checked ? (qIdx + 1 < quiz.length ? "Câu tiếp →" : "Xem kết quả") : "Kiểm tra"}</button>
              <button type="button" onClick={() => speak(`${cur.verb.v1}, ${cur.verb.v2}, ${cur.verb.v3}`)} disabled={!cur.checked} className="btn-outline px-5 py-2.5 disabled:opacity-40">Nghe 3 dạng</button>
            </div>
          </form>
        </div>
      )}

      {pdfVerbs && (
        <div ref={printRef} aria-hidden="true" style={{ position: "fixed", left: -10000, top: 0, pointerEvents: "none" }}>
          {Array.from({ length: Math.ceil(pdfVerbs.length / ROWS_PER_PDF_PAGE) }, (_, i) => (
            <PdfPage key={i} page={i + 1} pages={Math.ceil(pdfVerbs.length / ROWS_PER_PDF_PAGE)} title={onlyCommon ? "Bảng động từ bất quy tắc thông dụng" : "Bảng động từ bất quy tắc tiếng Anh"}
              verbs={pdfVerbs.slice(i * ROWS_PER_PDF_PAGE, (i + 1) * ROWS_PER_PDF_PAGE)} />
          ))}
        </div>
      )}
    </div>
  );
}
