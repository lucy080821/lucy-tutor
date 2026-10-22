"use client";
// Bảng "Giao diện trang": màu nền, kiểu giấy, font, cỡ chữ, màu chữ (xem trước ngay) + xuất ảnh PNG / PDF đúng giao diện.
import { useState } from "react";
import Swal from "sweetalert2";
import { BG_COLORS, FONTS, PAPERS, SIZES, TEXT_COLORS, hasStyle, isDark, linesCss, type PageStyle } from "./pageStyle";

export const DEFAULT_STYLE_KEY = "lucy_notes_default_style";
export function readDefaultStyle(): PageStyle | null {
  try { return JSON.parse(localStorage.getItem(DEFAULT_STYLE_KEY) || "null"); } catch { return null; }
}

function Swatch({ color, active, label, onClick, text }: { color?: string; active: boolean; label: string; onClick: () => void; text?: boolean }) {
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label} aria-pressed={active}
      className={`w-8 h-8 rounded-lg border flex items-center justify-center text-sm font-bold ${active ? "ring-2 ring-primary ring-offset-1 border-primary" : "border-line"}`}
      style={text ? { color: color || "#1f2d3d", background: color && !isDark(color) ? "#fff" : color ? "#1f2937" : "#fff" } : { background: color || "#fff" }}>
      {text ? "A" : !color ? <span className="text-[10px] text-muted">—</span> : null}
    </button>
  );
}

export default function StylePanel({ style, onChange, onClose, onExportPng, onExportPdf }: {
  style: PageStyle | null; onChange: (s: PageStyle | null) => void; onClose: () => void;
  onExportPng: () => Promise<void>; onExportPdf: () => Promise<void>;
}) {
  const st = style || {};
  const [busy, setBusy] = useState<"" | "png" | "pdf">("");
  const set = (patch: Partial<PageStyle>) => {
    const next = { ...st, ...patch } as PageStyle;
    (Object.keys(next) as (keyof PageStyle)[]).forEach((k) => { if (next[k] === undefined) delete next[k]; });
    onChange(hasStyle(next) ? next : null);
  };
  const run = async (kind: "png" | "pdf") => {
    setBusy(kind);
    try { await (kind === "png" ? onExportPng() : onExportPdf()); }
    catch { Swal.fire({ icon: "error", text: "Không xuất được file. Trang quá dài hoặc có ảnh không tải được — thử lại hoặc chia nhỏ trang." }); }
    finally { setBusy(""); }
  };

  return (
    <aside className="flex flex-col h-full bg-white" aria-label="Giao diện trang">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-line">
        <h2 className="font-bold text-primary">Giao diện trang</h2>
        <button type="button" onClick={onClose} className="ml-auto btn-ghost w-9 h-9 p-0 text-xl" aria-label="Đóng">×</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <section>
          <h3 className="ui-label">Màu nền</h3>
          <div className="flex flex-wrap gap-1.5">
            {BG_COLORS.map((c) => <Swatch key={c.label} color={c.value} label={c.label} active={st.bg === c.value} onClick={() => set({ bg: c.value })} />)}
            <label className="w-8 h-8 rounded-lg border border-dashed border-line-strong flex items-center justify-center cursor-pointer text-muted text-lg" title="Màu tuỳ chọn">
              +<input type="color" className="sr-only" value={st.bg || "#ffffff"} onChange={(e) => set({ bg: e.target.value })} aria-label="Màu nền tuỳ chọn" />
            </label>
          </div>
        </section>

        <section>
          <h3 className="ui-label">Kiểu giấy</h3>
          <div className="grid grid-cols-3 gap-2">
            {PAPERS.map((p) => {
              const active = (st.paper || "plain") === p.value;
              return (
                <button key={p.value} type="button" onClick={() => set({ paper: p.value === "plain" ? undefined : p.value })} aria-pressed={active}
                  className={`rounded-xl border p-1.5 text-left ${active ? "border-primary ring-2 ring-primary/30" : "border-line"}`}>
                  <span className="block h-12 rounded-lg border border-line" style={{ backgroundColor: st.bg || "#fff", ...linesCss({ ...st, paper: p.value, size: "sm" }), paddingLeft: undefined }} />
                  <span className="block text-xs font-semibold mt-1">{p.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <h3 className="ui-label">Font chữ</h3>
          <div className="grid grid-cols-2 gap-1.5">
            {FONTS.map((f) => {
              const active = (st.font || "default") === f.value;
              return (
                <button key={f.value} type="button" onClick={() => set({ font: f.value === "default" ? undefined : f.value })} aria-pressed={active}
                  className={`rounded-xl border px-3 py-2 text-left ${active ? "border-primary bg-primary-soft" : "border-line hover:border-primary"}`}>
                  <span className="block text-base leading-tight" style={{ fontFamily: f.stack }}>Tiếng Việt Aa</span>
                  <span className="block text-[11px] text-muted">{f.label}</span>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-muted mt-1.5">Dùng font có sẵn trên máy; máy không có font đó sẽ dùng font gần giống.</p>
        </section>

        <section>
          <h3 className="ui-label">Cỡ chữ</h3>
          <div className="flex gap-1.5">
            {SIZES.map((sz) => <button key={sz.value} type="button" onClick={() => set({ size: sz.value === "md" ? undefined : sz.value })} className={`ui-chip text-xs ${(st.size || "md") === sz.value ? "ui-chip-active" : ""}`}>{sz.label}</button>)}
          </div>
        </section>

        <section>
          <h3 className="ui-label">Màu chữ cả trang</h3>
          <div className="flex flex-wrap gap-1.5">
            {TEXT_COLORS.map((c) => <Swatch key={c.label} text color={c.value} label={c.label} active={st.text === c.value} onClick={() => set({ text: c.value })} />)}
            <label className="w-8 h-8 rounded-lg border border-dashed border-line-strong flex items-center justify-center cursor-pointer text-muted text-lg" title="Màu tuỳ chọn">
              +<input type="color" className="sr-only" value={st.text || "#111827"} onChange={(e) => set({ text: e.target.value })} aria-label="Màu chữ tuỳ chọn" />
            </label>
          </div>
          <p className="text-[11px] text-muted mt-1.5">Muốn đổi màu một vài chữ: bôi đen rồi chọn "Màu chữ" trên thanh công cụ.</p>
        </section>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => onChange(null)} className="btn-ghost px-3 py-2 text-sm">Đặt lại mặc định</button>
          <button type="button" onClick={() => {
            try { localStorage.setItem(DEFAULT_STYLE_KEY, JSON.stringify(style)); } catch { /* bỏ qua */ }
            Swal.fire({ icon: "success", text: "Trang mới (không chọn mẫu có giao diện riêng) sẽ dùng giao diện này trên trình duyệt này.", timer: 2000, showConfirmButton: false });
          }} className="btn-outline px-3 py-2 text-sm">Dùng cho trang mới</button>
        </div>

        <section className="pt-4 border-t border-line">
          <h3 className="ui-label">Xuất file đúng giao diện</h3>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={!!busy} onClick={() => run("png")} className="btn-primary py-2.5 text-sm">{busy === "png" ? "Đang tạo ảnh…" : "Tải ảnh PNG"}</button>
            <button type="button" disabled={!!busy} onClick={() => run("pdf")} className="btn-outline py-2.5 text-sm">{busy === "pdf" ? "Đang tạo PDF…" : "Tải PDF"}</button>
          </div>
          <p className="text-[11px] text-muted mt-1.5">Ảnh PNG là 1 ảnh dài cả trang (hợp để gửi Zalo/Messenger). PDF tự chia khổ A4.</p>
        </section>
      </div>
    </aside>
  );
}
