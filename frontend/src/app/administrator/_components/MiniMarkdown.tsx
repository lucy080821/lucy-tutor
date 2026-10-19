"use client";
import { Fragment, type ReactNode } from "react";

// Hiển thị Markdown của bài phân tích SEO (do routine Claude gửi lên) — chỉ hỗ trợ phần cú pháp bài dùng:
// tiêu đề #/##/###, đoạn văn, danh sách -/*/1., bảng |…|, trích dẫn >, kẻ ngang ---, **đậm**, *nghiêng*, `code`,
// [link](url). Dựng thẳng thành phần tử React (không dangerouslySetInnerHTML) nên nội dung lạ không chèn được HTML.

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|\*([^*\s][^*]*)\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${m.index}`;
    if (m[2]) out.push(<strong key={k} className="font-bold text-foreground">{m[2]}</strong>);
    else if (m[3]) out.push(<code key={k} className="px-1 py-0.5 rounded bg-slate-100 text-[0.85em] break-all">{m[3]}</code>);
    else if (m[4]) {
      const href = /^(https?:\/\/|\/)/.test(m[5]) ? m[5] : undefined; // chỉ link http(s) hoặc nội bộ
      out.push(href
        ? <a key={k} href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline break-all">{m[4]}</a>
        : m[4]);
    } else if (m[6]) out.push(<em key={k}>{m[6]}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const cells = (line: string) => line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
const isTableSep = (line: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);

export default function MiniMarkdown({ source }: { source: string }) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const key = `b${i}`;
    if (!line.trim()) { i++; continue; }

    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const cls = level === 1 ? "text-xl font-extrabold text-primary mt-2"
        : level === 2 ? "text-lg font-bold text-primary mt-6 pt-4 border-t border-line first:border-0 first:pt-0 first:mt-0"
        : "text-base font-bold text-foreground mt-4";
      const Tag = (level === 1 ? "h3" : level === 2 ? "h4" : "h5") as "h3" | "h4" | "h5";
      blocks.push(<Tag key={key} className={cls}>{inline(h[2])}</Tag>);
      i++; continue;
    }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) { blocks.push(<hr key={key} className="border-line my-4" />); i++; continue; }

    // Bảng: dòng tiêu đề + dòng |---|
    if (line.includes("|") && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const head = cells(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) rows.push(cells(lines[i++]));
      blocks.push(
        <div key={key} className="overflow-x-auto my-3">
          <table className="ui-table w-full text-sm">
            <thead><tr>{head.map((c, j) => <th key={j}>{inline(c)}</th>)}</tr></thead>
            <tbody>{rows.map((r, ri) => <tr key={ri}>{head.map((_, j) => <td key={j}>{inline(r[j] ?? "")}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
      continue;
    }

    if (/^\s*>/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) quote.push(lines[i++].replace(/^\s*>\s?/, ""));
      blocks.push(<blockquote key={key} className="my-3 border-l-4 border-primary/30 bg-primary-soft rounded-r-lg px-4 py-2 text-sm">{inline(quote.join(" "))}</blockquote>);
      continue;
    }

    const listRe = /^\s*([-*]|\d+[.)])\s+/;
    if (listRe.test(line)) {
      const ordered = /^\s*\d/.test(line);
      const items: { text: string; nested: boolean }[] = [];
      while (i < lines.length && listRe.test(lines[i])) {
        items.push({ text: lines[i].replace(listRe, ""), nested: /^\s{2,}/.test(lines[i]) });
        i++;
      }
      const List = ordered ? "ol" : "ul";
      blocks.push(
        <List key={key} className={`${ordered ? "list-decimal" : "list-disc"} pl-6 space-y-1 my-2`}>
          {items.map((it, j) => <li key={j} className={it.nested ? "ml-5" : ""}>{inline(it.text)}</li>)}
        </List>,
      );
      continue;
    }

    // Đoạn văn: gom các dòng liền nhau
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|\s*>|\s*([-*]|\d+[.)])\s)/.test(lines[i])
      && !(lines[i].includes("|") && i + 1 < lines.length && isTableSep(lines[i + 1]))) para.push(lines[i++]);
    if (!para.length) para.push(lines[i++]); // phòng vòng lặp kẹt với dòng lạ
    blocks.push(<p key={key} className="my-2">{para.map((p, j) => <Fragment key={j}>{j > 0 && " "}{inline(p)}</Fragment>)}</p>);
  }
  return <div className="text-sm text-foreground/90 leading-relaxed">{blocks}</div>;
}
