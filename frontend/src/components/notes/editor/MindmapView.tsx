"use client";
import { useMemo } from "react";
import { NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";
import Swal from "sweetalert2";
import { useNoteEditorCtx } from "./context";

export type MindNode = { label: string; children?: MindNode[] };

const BRANCH_COLORS = ["#1E3A8A", "#3b82f6", "#10b981", "#f9a95a", "#8b5cf6", "#ef4444", "#0ea5e9", "#64748b"];
const ROW = 34;
const COL = 190;
const charW = 7.2;

type Placed = { node: MindNode; x: number; y: number; w: number; depth: number; color: string; parent?: Placed };

function layout(root: MindNode) {
  const placed: Placed[] = [];
  let cursor = 0;
  const leaves = (n: MindNode): number => (n.children?.length ? n.children.reduce((s, c) => s + leaves(c), 0) : 1);
  const visit = (n: MindNode, depth: number, color: string, parent?: Placed): Placed => {
    const w = Math.min(170, Math.max(60, n.label.length * charW + 24));
    const me: Placed = { node: n, x: depth * COL, y: 0, w, depth, color, parent };
    placed.push(me);
    if (n.children?.length) {
      const kids = n.children.map((c, i) => visit(c, depth + 1, depth === 0 ? BRANCH_COLORS[i % BRANCH_COLORS.length] : color, me));
      me.y = (kids[0].y + kids[kids.length - 1].y) / 2;
    } else {
      me.y = cursor * ROW + ROW / 2;
      cursor += 1;
    }
    return me;
  };
  visit(root, 0, BRANCH_COLORS[0]);
  return { placed, height: Math.max(leaves(root) * ROW, ROW), width: Math.max(...placed.map((p) => p.x + p.w)) + 8 };
}

export const toOutline = (n: MindNode, depth = 0): string =>
  [`${"  ".repeat(depth)}${n.label}`, ...(n.children || []).map((c) => toOutline(c, depth + 1))].join("\n");

export function fromOutline(text: string): MindNode | null {
  const lines = text.split("\n").filter((l) => l.trim());
  if (!lines.length) return null;
  const root: MindNode = { label: lines[0].trim().replace(/^[-*•]\s*/, ""), children: [] };
  const stack: { node: MindNode; indent: number }[] = [{ node: root, indent: -1 }];
  for (const line of lines.slice(1)) {
    const indent = line.match(/^\s*/)![0].replace(/\t/g, "  ").length;
    const node: MindNode = { label: line.trim().replace(/^[-*•]\s*/, "").slice(0, 80), children: [] };
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop();
    stack[stack.length - 1].node.children!.push(node);
    stack.push({ node, indent });
  }
  return root;
}

export default function MindmapView({ node, updateAttributes, deleteNode }: ReactNodeViewProps) {
  const { editable } = useNoteEditorCtx();
  const root: MindNode = useMemo(() => {
    try { return JSON.parse(node.attrs.data || "{}"); } catch { return { label: "Chủ đề", children: [] }; }
  }, [node.attrs.data]);
  const { placed, height, width } = useMemo(() => layout(root.label ? root : { label: "Chủ đề", children: [] }), [root]);

  const edit = async () => {
    const { value } = await Swal.fire({
      title: "Sửa sơ đồ tư duy",
      html: '<p style="font-size:13px;color:#64748b;margin:0 0 6px">Dòng đầu là chủ đề chính. Mỗi ý con lùi vào 2 dấu cách so với ý cha.</p>',
      input: "textarea",
      inputValue: toOutline(root),
      inputAttributes: { style: "min-height:260px;font-family:monospace;font-size:13px" },
      showCancelButton: true, confirmButtonText: "Cập nhật", cancelButtonText: "Huỷ",
    });
    if (value === undefined) return;
    const next = fromOutline(String(value));
    if (next) updateAttributes({ data: JSON.stringify(next) });
  };

  return (
    <NodeViewWrapper className="note-mindmap" contentEditable={false}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-bold uppercase tracking-wider text-muted">Sơ đồ tư duy</span>
        {editable && (
          <span className="ml-auto flex gap-1">
            <button type="button" className="ui-chip text-xs" onClick={edit}>Sửa</button>
            <button type="button" className="btn-ghost w-9 h-9 p-0 text-lg" aria-label="Xoá sơ đồ" title="Xoá sơ đồ" onClick={deleteNode}>×</button>
          </span>
        )}
      </div>
      <div className="overflow-x-auto">
        <svg width={width} height={height} role="img" aria-label={`Sơ đồ tư duy: ${root.label}`} className="block">
          {placed.filter((p) => p.parent).map((p, i) => {
            const a = p.parent!;
            const x1 = a.x + a.w; const y1 = a.y; const x2 = p.x; const y2 = p.y; const mx = (x1 + x2) / 2;
            return <path key={`l${i}`} d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`} fill="none" stroke={p.color} strokeOpacity={0.55} strokeWidth={p.depth === 1 ? 2.5 : 1.5} />;
          })}
          {placed.map((p, i) => (
            <g key={`n${i}`} transform={`translate(${p.x},${p.y - 13})`}>
              <rect width={p.w} height={26} rx={13} fill={p.depth === 0 ? p.color : p.depth === 1 ? `${p.color}1f` : "#fff"} stroke={p.color} strokeOpacity={p.depth === 0 ? 1 : 0.5} />
              <text x={p.w / 2} y={17} textAnchor="middle" fontSize={12.5} fontWeight={p.depth <= 1 ? 700 : 500} fill={p.depth === 0 ? "#fff" : "#1f2d3d"}>
                {p.node.label.length > 22 ? `${p.node.label.slice(0, 21)}…` : p.node.label}
              </text>
              <title>{p.node.label}</title>
            </g>
          ))}
        </svg>
      </div>
    </NodeViewWrapper>
  );
}
