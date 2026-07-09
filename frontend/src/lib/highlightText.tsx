// Shared convention: AI analysis text may wrap important phrases in **like this**
// to mark them for attention. Used both for on-page <mark> rendering and for
// highlighted runs in exported Word documents (see wordExport.ts).

export interface HighlightSegment {
  text: string;
  highlight: boolean;
}

export function parseHighlightSegments(text: string): HighlightSegment[] {
  const segments: HighlightSegment[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index), highlight: false });
    }
    segments.push({ text: match[1], highlight: true });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), highlight: false });
  }
  return segments;
}

export function HighlightedText({ text }: { text: string }) {
  if (!text) return null;
  return (
    <>
      {parseHighlightSegments(text).map((seg, i) =>
        seg.highlight ? (
          <mark key={i} className="bg-amber-200 text-amber-900 font-semibold px-0.5 rounded">
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </>
  );
}
