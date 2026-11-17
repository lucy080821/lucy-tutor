// Xuất giao dịch thu chi cá nhân ra file Excel (.xlsx) theo bộ lọc: khoảng ngày, chỉ thu / chỉ chi / cả hai, danh mục, từ khoá.
// Chạy hoàn toàn trên trình duyệt từ dữ liệu đã tải (không gọi API thêm). Thư viện xlsx-js-style chỉ tải khi bấm xuất.
import { bigOf, categoryLabel, fullDayLabel, WEEKDAYS, weekdayOf, type PfCategory, type PfData, type PfTx } from "@/lib/personalFinance";

export type ExportKind = "ALL" | "INCOME" | "EXPENSE";
export type ExportOpts = {
  from: string; to: string; kind: ExportKind;
  /** Danh mục lớn cần lấy ("" = mọi danh mục) */
  bigId: string;
  /** Chỉ lấy giao dịch có chi tiết/danh mục chứa chuỗi này */
  search: string;
  order: "ASC" | "DESC";
  /** Thêm 2 sheet tổng hợp theo danh mục và theo ngày */
  summary: boolean;
};

export const KIND_LABEL: Record<ExportKind, string> = { ALL: "Thu và chi", INCOME: "Chỉ thu", EXPENSE: "Chỉ chi" };

const dmy = (iso: string) => `${iso.slice(8)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
// Số ngày kiểu Excel (1900 date system) từ chuỗi YYYY-MM-DD
const excelSerial = (iso: string) => Math.round(Date.parse(`${iso}T00:00:00Z`) / 86400000) + 25569;

export function filterForExport(data: PfData, o: ExportOpts): PfTx[] {
  const byId = new Map(data.categories.map((c) => [c.id, c]));
  const q = o.search.trim().toLowerCase();
  const rows = data.transactions.filter((t) => {
    if (t.date < o.from || t.date > o.to) return false;
    if (o.kind !== "ALL" && t.type !== o.kind) return false;
    const c = byId.get(t.categoryId);
    if (o.bigId && (c ? bigOf(c, byId).id : "") !== o.bigId) return false;
    if (q && !`${t.detail ?? ""} ${categoryLabel(c, byId)}`.toLowerCase().includes(q)) return false;
    return true;
  });
  rows.sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? -1 : 1) * (o.order === "ASC" ? 1 : -1));
  return rows;
}

export function totalsOf(rows: PfTx[]) {
  let income = 0, expense = 0;
  for (const t of rows) { if (t.type === "INCOME") income += t.amount; else expense += t.amount; }
  return { income, expense, net: income - expense };
}

export function exportFileName(o: ExportOpts) {
  const kind = o.kind === "ALL" ? "thu-chi" : o.kind === "INCOME" ? "thu" : "chi";
  return `${kind}_${o.from}_${o.to}.xlsx`;
}

export async function exportTransactionsXlsx(data: PfData, o: ExportOpts): Promise<{ rows: number; fileName: string }> {
  const mod: any = await import("xlsx-js-style");
  const XLSX: typeof import("xlsx-js-style") = mod.utils ? mod : mod.default;
  const byId = new Map<string, PfCategory>(data.categories.map((c) => [c.id, c]));
  const rows = filterForExport(data, o);
  const { income, expense, net } = totalsOf(rows);

  const thin = { style: "thin", color: { rgb: "CBD5E1" } } as const;
  const border = { top: thin, bottom: thin, left: thin, right: thin };
  const head = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "1E3A8A" } }, alignment: { horizontal: "center", vertical: "center", wrapText: true }, border };
  const cell = { border, alignment: { vertical: "top", wrapText: true } };
  const money = { ...cell, numFmt: "#,##0", alignment: { horizontal: "right", vertical: "top" } };
  const bold = { font: { bold: true }, fill: { fgColor: { rgb: "EEF2FF" } }, border };

  // ── Sheet 1: danh sách giao dịch ────────────────────────────────────────────
  const aoa: any[][] = [
    [{ v: "SỔ THU CHI CÁ NHÂN", s: { font: { bold: true, sz: 16, color: { rgb: "1E3A8A" } } } }],
    [`Khoảng thời gian: ${dmy(o.from)} – ${dmy(o.to)}   |   Loại: ${KIND_LABEL[o.kind]}   |   Danh mục: ${o.bigId ? (byId.get(o.bigId)?.name ?? "(đã xoá)") : "Tất cả"}${o.search.trim() ? `   |   Tìm: "${o.search.trim()}"` : ""}`],
    [`Xuất lúc: ${new Date().toLocaleString("vi-VN")}   |   ${rows.length} giao dịch   |   Đơn vị: VND`],
    [],
    ["STT", "Ngày", "Thứ", "Loại", "Danh mục lớn", "Danh mục nhỏ", "Chi tiết sử dụng", "Số tiền (VND)"].map((v) => ({ v, s: head })),
  ];
  const first = aoa.length + 1; // dòng Excel của giao dịch đầu tiên (1-based)
  rows.forEach((t, i) => {
    const c = byId.get(t.categoryId);
    const big = c ? bigOf(c, byId) : undefined;
    const isIncome = t.type === "INCOME";
    aoa.push([
      { v: i + 1, t: "n", s: { ...cell, alignment: { horizontal: "center", vertical: "top" } } },
      { v: excelSerial(t.date), t: "n", s: { ...cell, numFmt: "dd/mm/yyyy", alignment: { horizontal: "center", vertical: "top" } } },
      { v: WEEKDAYS[weekdayOf(t.date)], s: { ...cell, alignment: { horizontal: "center", vertical: "top" } } },
      { v: isIncome ? "Thu" : "Chi", s: { ...cell, font: { bold: true, color: { rgb: isIncome ? "047857" : "B91C1C" } }, alignment: { horizontal: "center", vertical: "top" } } },
      { v: big?.name ?? "(đã xoá)", s: cell },
      { v: c && c.parentId ? c.name : "", s: cell },
      { v: t.detail ?? "", s: cell },
      { v: t.amount, t: "n", s: { ...money, font: { color: { rgb: isIncome ? "047857" : "B91C1C" } } } },
    ]);
  });
  const last = aoa.length; // dòng Excel cuối cùng của dữ liệu
  const hasRows = rows.length > 0;
  const rng = (col: string) => `${col}${first}:${col}${last}`;
  aoa.push([]);
  const sumRow = (label: string, f: string, v: number, color?: string) => [
    { v: "", s: bold }, { v: "", s: bold }, { v: "", s: bold }, { v: "", s: bold }, { v: "", s: bold }, { v: "", s: bold },
    { v: label, s: { ...bold, alignment: { horizontal: "right" } } },
    { v, t: "n", f: hasRows ? f : undefined, s: { ...bold, numFmt: "#,##0", alignment: { horizontal: "right" }, font: { bold: true, ...(color ? { color: { rgb: color } } : {}) } } },
  ];
  const sumStart = aoa.length + 1;
  aoa.push(sumRow("Tổng thu", `SUMIF(${rng("D")},"Thu",${rng("H")})`, income, "047857"));
  aoa.push(sumRow("Tổng chi", `SUMIF(${rng("D")},"Chi",${rng("H")})`, expense, "B91C1C"));
  aoa.push(sumRow("Chênh lệch (thu − chi)", `H${sumStart}-H${sumStart + 1}`, net, net >= 0 ? "047857" : "B91C1C"));

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 6 }, { wch: 12 }, { wch: 6 }, { wch: 7 }, { wch: 22 }, { wch: 22 }, { wch: 46 }, { wch: 16 }];
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } }, { s: { r: 2, c: 0 }, e: { r: 2, c: 7 } }];
  ws["!rows"] = [{ hpt: 26 }];
  if (hasRows) ws["!autofilter"] = { ref: `A5:H${last}` };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Giao dịch");

  // ── Sheet 2, 3: tổng hợp ───────────────────────────────────────────────────
  if (o.summary && hasRows) {
    const byCat = new Map<string, { type: "INCOME" | "EXPENSE"; name: string; count: number; total: number }>();
    for (const t of rows) {
      const c = byId.get(t.categoryId); const big = c ? bigOf(c, byId) : undefined;
      const key = `${t.type}|${big?.id ?? "x"}`;
      const cur = byCat.get(key) ?? { type: t.type, name: big?.name ?? "(đã xoá)", count: 0, total: 0 };
      cur.count++; cur.total += t.amount; byCat.set(key, cur);
    }
    const typeTotal = { INCOME: income, EXPENSE: expense };
    const list = [...byCat.values()].sort((a, b) => (a.type === b.type ? b.total - a.total : a.type === "INCOME" ? -1 : 1));
    const cat: any[][] = [["Loại", "Danh mục lớn", "Số giao dịch", "Tổng tiền (VND)", "Tỷ lệ trong loại"].map((v) => ({ v, s: head }))];
    for (const r of list) cat.push([
      { v: r.type === "INCOME" ? "Thu" : "Chi", s: { ...cell, font: { bold: true, color: { rgb: r.type === "INCOME" ? "047857" : "B91C1C" } } } },
      { v: r.name, s: cell },
      { v: r.count, t: "n", s: { ...cell, alignment: { horizontal: "center" } } },
      { v: r.total, t: "n", s: money },
      { v: typeTotal[r.type] ? r.total / typeTotal[r.type] : 0, t: "n", s: { ...cell, numFmt: "0.0%", alignment: { horizontal: "right" } } },
    ]);
    const w2 = XLSX.utils.aoa_to_sheet(cat);
    w2["!cols"] = [{ wch: 8 }, { wch: 28 }, { wch: 14 }, { wch: 18 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, w2, "Theo danh mục");

    const byDay = new Map<string, { income: number; expense: number }>();
    for (const t of rows) { const d = byDay.get(t.date) ?? { income: 0, expense: 0 }; if (t.type === "INCOME") d.income += t.amount; else d.expense += t.amount; byDay.set(t.date, d); }
    const day: any[][] = [["Ngày", "Thứ", "Thu (VND)", "Chi (VND)", "Chênh lệch (VND)"].map((v) => ({ v, s: head }))];
    for (const [d, v] of [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) day.push([
      { v: excelSerial(d), t: "n", s: { ...cell, numFmt: "dd/mm/yyyy", alignment: { horizontal: "center" } } },
      { v: WEEKDAYS[weekdayOf(d)], s: { ...cell, alignment: { horizontal: "center" } } },
      { v: v.income, t: "n", s: money }, { v: v.expense, t: "n", s: money }, { v: v.income - v.expense, t: "n", s: { ...money, font: { bold: true, color: { rgb: v.income - v.expense >= 0 ? "047857" : "B91C1C" } } } },
    ]);
    const w3 = XLSX.utils.aoa_to_sheet(day);
    w3["!cols"] = [{ wch: 13 }, { wch: 7 }, { wch: 16 }, { wch: 16 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, w3, "Theo ngày");
  }

  const fileName = exportFileName(o);
  XLSX.writeFile(wb, fileName);
  return { rows: rows.length, fileName };
}

export { fullDayLabel };
