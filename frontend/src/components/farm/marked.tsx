import type { ReactNode } from "react";
// Chữ có phần gạch chân đánh dấu bằng [..] (vd "b[oo]k") → hiển thị gạch chân đậm (dạng bài phát âm THPT)
export function renderMarked(text: string): ReactNode {
  const parts = text.split(/(\[[^\]]+\])/g);
  return parts.map((p, i) => (/^\[[^\]]+\]$/.test(p) ? <u key={i} className="font-extrabold underline decoration-2 underline-offset-2">{p.slice(1, -1)}</u> : <span key={i}>{p}</span>));
}
export const plain = (text: string) => text.replace(/[\[\]]/g, "");
