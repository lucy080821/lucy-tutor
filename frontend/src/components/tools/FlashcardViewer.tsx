"use client";
import { useEffect, useRef, useState } from "react";
import { UPDATING_TEXT, type FlashGrade, type FlashUnit } from "@/lib/tools/flashcards";

const CARDS_PER_PAGE = 12; // 3 cột × 4 hàng trên 1 trang A4

function speak(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  u.rate = 0.85;
  window.speechSynthesis.speak(u);
}

/** 1 trang in (800×1131px ≈ A4): thẻ kiểu "gấp đôi" — nửa trên tiếng Anh, nửa dưới nghĩa xoay ngược 180°
 *  để khi gấp theo nét đứt hai mặt đều đọc xuôi chiều. */
function PrintPage({ grade, unit, cards, page, pages }: { grade: number; unit: FlashUnit; cards: FlashUnit["cards"]; page: number; pages: number }) {
  return (
    <div data-pdf-page style={{ width: 800, height: 1131, padding: "36px 40px", boxSizing: "border-box", background: "#fff", fontFamily: "Calibri, Arial, sans-serif", color: "#0f172a", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "2px solid #1E3A8A", paddingBottom: 8 }}>
        <div>
          <div style={{ fontSize: 13, color: "#64748b" }}>Flashcard Tiếng Anh lớp {grade} · Global Success</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#1E3A8A" }}>{unit.label}: {unit.title}</div>
        </div>
        <div style={{ fontSize: 12, color: "#64748b", textAlign: "right" }}>lucytutor.online<br />Trang {page}/{pages}</div>
      </div>
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gridTemplateRows: "repeat(4, 1fr)", gap: 14, marginTop: 16 }}>
        {cards.map((c) => (
          <div key={c.en} style={{ border: "1.5px dashed #94a3b8", borderRadius: 12, display: "flex", flexDirection: "column" }}>
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 8, textAlign: "center", fontSize: c.en.length > 16 ? 19 : 24, fontWeight: 800, color: "#1E3A8A" }}>{c.en}</div>
            <div style={{ borderTop: "1px dashed #cbd5e1" }} />
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 8, textAlign: "center", fontSize: c.vi.length > 22 ? 15 : 18, transform: "rotate(180deg)" }}>{c.vi}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", marginTop: 10 }}>Cắt theo viền nét đứt, gấp đôi theo đường giữa thẻ: một mặt từ tiếng Anh, một mặt nghĩa tiếng Việt.</div>
    </div>
  );
}

const PDF_REQUEST_EVENT = "lucy:flashcard-pdf";
const PDF_STATUS_EVENT = "lucy:flashcard-pdf-status";

/** Nút tải PDF cả lớp đặt trên banner đầu trang (above the fold) — FlashcardViewer cùng trang thực hiện việc xuất. */
export function FlashcardPdfButton({ grade }: { grade: number }) {
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const onStatus = (e: Event) => setBusy(Boolean((e as CustomEvent<boolean>).detail));
    window.addEventListener(PDF_STATUS_EVENT, onStatus);
    return () => window.removeEventListener(PDF_STATUS_EVENT, onStatus);
  }, []);
  return (
    <button type="button" disabled={busy} onClick={() => window.dispatchEvent(new Event(PDF_REQUEST_EVENT))}
      className="btn-primary lp-shine px-7 py-3.5 text-base disabled:opacity-60">
      {busy ? "Đang tạo PDF..." : `Tải PDF lớp ${grade} miễn phí`}
    </button>
  );
}

export default function FlashcardViewer({ data }: { data: FlashGrade }) {
  const firstReady = Math.max(0, data.units.findIndex((u) => u.cards.length > 0));
  const readyList = data.units.filter((u) => u.cards.length > 0);
  const [unitIdx, setUnitIdx] = useState(firstReady);
  const [order, setOrder] = useState<number[]>(() => (data.units[firstReady]?.cards ?? []).map((_, i) => i));
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [printUnits, setPrintUnits] = useState<FlashUnit[] | null>(null);
  const [exporting, setExporting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const unit = data.units[unitIdx];
  const card = unit?.cards[order[pos]];

  const chooseUnit = (i: number) => {
    setUnitIdx(i); setOrder(data.units[i].cards.map((_, k) => k)); setPos(0); setFlipped(false);
  };
  const go = (d: number) => { if (order.length) { setPos((p) => (p + d + order.length) % order.length); setFlipped(false); } };
  const shuffle = () => {
    const a = unit.cards.map((_, k) => k);
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    setOrder(a); setPos(0); setFlipped(false);
  };

  // Phím tắt: ← → chuyển thẻ, Space lật thẻ
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === " ") { e.preventDefault(); setFlipped((f) => !f); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Khi danh sách trang in đã render (ẩn ngoài màn hình) → chụp từng trang thành PDF
  useEffect(() => {
    if (!printUnits || !printRef.current) return;
    let cancelled = false;
    (async () => {
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      const nodes = Array.from(printRef.current?.querySelectorAll<HTMLElement>("[data-pdf-page]") ?? []);
      const name = printUnits.length === 1
        ? `flashcard-tieng-anh-lop-${data.grade}-${printUnits[0].label.toLowerCase().replace(/\s+/g, "-")}.pdf`
        : `flashcard-tieng-anh-lop-${data.grade}.pdf`;
      try {
        const { exportPagesToPDF } = await import("@/lib/pdfExport");
        if (!cancelled) await exportPagesToPDF(nodes, name);
      } finally {
        if (!cancelled) { setPrintUnits(null); setExporting(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [printUnits, data.grade]);

  const exportPdf = (units: FlashUnit[]) => { setExporting(true); setPrintUnits(units); };

  // Nút "Tải PDF cả lớp" trên banner đầu trang (FlashcardPdfButton) gọi sang đây qua sự kiện window
  useEffect(() => {
    const onRequest = () => { if (!exporting && readyList.length) exportPdf(readyList); };
    window.addEventListener(PDF_REQUEST_EVENT, onRequest);
    return () => window.removeEventListener(PDF_REQUEST_EVENT, onRequest);
  });
  useEffect(() => {
    window.dispatchEvent(new CustomEvent(PDF_STATUS_EVENT, { detail: exporting }));
  }, [exporting]);

  if (!readyList.length) {
    return (
      <div className="ui-card p-8 sm:p-10 text-center">
        <p className="text-lg font-bold text-primary">{UPDATING_TEXT}</p>
        <p className="mt-2 text-sm text-muted">Từ vựng lớp {data.grade} sẽ tự xuất hiện tại đây khi có Unit mới — hệ thống kiểm tra mỗi cuối ngày.</p>
      </div>
    );
  }

  return (
    <div className="ui-card p-5 sm:p-8">
      {/* Tải PDF */}
      <div id="tai-pdf" className="scroll-mt-20 mb-6 pb-6 border-b border-line flex flex-col sm:flex-row sm:items-center gap-3">
        <p className="text-sm text-muted flex-1">Tải flashcard PDF để in: 12 thẻ mỗi trang A4, cắt rời và gấp đôi là dùng được.</p>
        <button onClick={() => exportPdf([unit])} disabled={exporting || !card} className="btn-primary px-5 py-2.5 disabled:opacity-50">
          {exporting ? "Đang tạo PDF..." : `Tải PDF ${unit.label}`}
        </button>
        <button onClick={() => exportPdf(readyList)} disabled={exporting} className="btn-outline px-5 py-2.5 disabled:opacity-50">
          Tải PDF cả lớp {data.grade}
        </button>
      </div>

      <h2 className="text-lg font-bold text-primary">Chọn Unit</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {data.units.map((u, i) => (
          <button key={u.label} onClick={() => chooseUnit(i)} title={u.cards.length ? u.title : `${u.title} — ${UPDATING_TEXT}`}
            className={`ui-chip cursor-pointer ${i === unitIdx ? "ui-chip-active" : ""} ${u.cards.length ? "" : "opacity-50"}`}>{u.label}</button>
        ))}
      </div>
      <p className="mt-3 text-sm text-muted">{unit.label}: <b className="text-foreground">{unit.title}</b> · {unit.cards.length ? `${unit.cards.length} thẻ` : UPDATING_TEXT}</p>

      {/* Thẻ lật */}
      {!card ? (
        <div className="mt-5 max-w-xl mx-auto w-full aspect-[16/10] rounded-2xl border-2 border-dashed border-line flex flex-col items-center justify-center p-6 text-center">
          <span className="text-lg font-bold text-primary">{UPDATING_TEXT}</span>
          <span className="mt-2 text-sm text-muted">Unit này chưa có từ vựng. Chọn Unit khác hoặc quay lại sau.</span>
        </div>
      ) : (
      <div className="mt-5 max-w-xl mx-auto">
        <button onClick={() => setFlipped((f) => !f)} aria-label="Lật thẻ"
          className={`w-full aspect-[16/10] rounded-2xl border-2 flex flex-col items-center justify-center p-6 text-center transition-colors cursor-pointer ${flipped ? "bg-primary text-white border-primary" : "bg-white border-line hover:border-primary/50"}`}>
          {flipped ? (
            <>
              <span className="text-xs uppercase tracking-wide text-white/70">Nghĩa tiếng Việt</span>
              <span className="mt-2 text-2xl sm:text-3xl font-bold">{card.vi}</span>
              {card.example && <span className="mt-3 text-sm sm:text-base italic text-white/85">&ldquo;{card.example}&rdquo;</span>}
            </>
          ) : (
            <>
              <span className="text-xs uppercase tracking-wide text-muted">English</span>
              <span className="mt-2 text-3xl sm:text-4xl font-extrabold text-primary">{card.en}</span>
              {(card.phonetic || card.pos) && (
                <span className="mt-2 text-base text-muted">{card.phonetic}{card.pos && <span className="ml-2 text-sm">({card.pos})</span>}</span>
              )}
            </>
          )}
          <span className={`mt-4 text-xs ${flipped ? "text-white/70" : "text-muted"}`}>Bấm vào thẻ (hoặc phím Space) để lật</span>
        </button>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <button onClick={() => go(-1)} className="btn-ghost px-4 py-2.5" aria-label="Thẻ trước">← Trước</button>
          <div className="flex items-center gap-2">
            <button onClick={() => speak(card.en)} className="btn-outline px-4 py-2.5" aria-label={`Nghe phát âm ${card.en}`}>Nghe</button>
            <button onClick={shuffle} className="btn-outline px-4 py-2.5">Xáo trộn</button>
          </div>
          <button onClick={() => go(1)} className="btn-ghost px-4 py-2.5" aria-label="Thẻ sau">Sau →</button>
        </div>
        <p className="mt-2 text-center text-sm text-muted">Thẻ {pos + 1}/{order.length}</p>
      </div>
      )}

      {printUnits && (
        <div ref={printRef} aria-hidden="true" style={{ position: "fixed", left: -10000, top: 0, pointerEvents: "none" }}>
          {printUnits.flatMap((u) => {
            const pages = Math.ceil(u.cards.length / CARDS_PER_PAGE);
            return Array.from({ length: pages }, (_, p) => (
              <PrintPage key={`${u.label}-${p}`} grade={data.grade} unit={u} page={p + 1} pages={pages}
                cards={u.cards.slice(p * CARDS_PER_PAGE, (p + 1) * CARDS_PER_PAGE)} />
            ));
          })}
        </div>
      )}
    </div>
  );
}
