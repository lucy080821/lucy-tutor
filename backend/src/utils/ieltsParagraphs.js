// Restores paragraph breaks in an extracted IELTS Reading passage.
//
// The AI extractor tends to return a passage as one long block, but the printed book clearly
// separates paragraphs. Cambridge books indent instead of leaving a blank line and justify the
// text, so neither blank lines nor line length are reliable in the raw PDF text; the cue that
// holds up is a line that ends a sentence followed by a line starting with a capital — a sentence
// rarely ends exactly at a wrapped line's edge, so this occasionally over-splits but never glues
// two paragraphs together. Academic passages may also label paragraphs "A", "B"... We read
// those cues off the raw page text and re-insert "\n\n" into the AI's bodyText at the matching spots — no extra AI call.

const SENTENCE_END = /[.?!:]["'”’)\]]?$/;
const TAIL_CHARS = 30; // alnum chars used to locate a paragraph end inside bodyText

const cleanLine = (l) => l.replace(/\s+/g, ' ').trim();

// Returns the alnum-only "tail" (last TAIL_CHARS letters/digits) of every paragraph that ends on
// these pages, plus the heads of lines that start a lettered paragraph.
function paragraphCues(pages) {
  const ends = [];
  const labelledStarts = [];
  // Question blocks quote names/phrases from the passage and would yield false cues, so sentence
  // ends are only taken outside them ("Questions 14-20" opens one; the passage header closes it).
  // A full-width lettered line counts anywhere: a passage printed after its List of Headings has
  // no header to reopen it, and answer options rarely repeat the passage word for word.
  let inQuestions = false;
  for (const page of pages) {
    const lines = (page.text || '').split('\n').map(cleanLine).filter(Boolean);
    let tail = '';
    lines.forEach((line, i) => {
      tail = (tail + ' ' + line).slice(-200);
      const next = lines[i + 1] || '';
      if (/^questions?\s+\d/i.test(line)) inQuestions = true;
      else if (/^(reading\s+passage|you should spend)/i.test(line)) inQuestions = false;
      // "A" alone on a line (or "A The museum...") marks the start of a lettered paragraph
      const label = /^([A-J])(?:\s+(.*))?$/.exec(line);
      // — but only a full-width line: "A Justin Feinstein" in a matching-features list is not one
      if (label && label[2] && /^[A-Z]/.test(label[2]) && alnum(label[2]).length >= 40) labelledStarts.push({ letter: label[1], head: alnum(label[2]).slice(0, TAIL_CHARS) });
      else if (label && !label[2] && next && !inQuestions) labelledStarts.push({ letter: label[1], head: alnum(next).slice(0, TAIL_CHARS) });
      if (!inQuestions && SENTENCE_END.test(line) && /^[A-Z0-9"“‘(]/.test(next)) {
        ends.push(alnum(tail).slice(-TAIL_CHARS));
      }
    });
  }
  return { ends: ends.filter((t) => t.length >= 15), labelledStarts: labelledStarts.filter((s) => s.head.length >= 15) };
}

// The PDF text has OCR slips the AI quietly fixes ("well-lmown" vs "well-known"), so a cue that
// misses at full length is retried with shorter tails/heads — only accepted when unique.
function findCue(flat, cue, fromEnd) {
  const hit = flat.indexOf(cue);
  if (hit >= 0) return { hit, len: cue.length };
  for (const len of [20, 14]) {
    if (cue.length <= len) continue;
    const part = fromEnd ? cue.slice(-len) : cue.slice(0, len);
    const i = flat.indexOf(part);
    if (i >= 0 && i === flat.lastIndexOf(part)) return { hit: i, len };
  }
  return null;
}

function alnum(s) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Lowercased alnum projection of `text` + map from each projected char back to its index.
function project(text) {
  let flat = '';
  const pos = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i].toLowerCase();
    if (/[a-z0-9]/.test(c)) { flat += c; pos.push(i); }
  }
  return { flat, pos };
}

// `force`: re-derive breaks even if bodyText already has paragraphs (flattens it first — loses
// any manual paragraphing, so only for re-running this function's own output).
function restoreParagraphs(bodyText, pages, { force = false } = {}) {
  if (!bodyText) return bodyText;
  if (/\n\s*\n/.test(bodyText)) {
    if (!force) return bodyText; // already paragraphed
    bodyText = bodyText.replace(/\s*\n\s*\n\s*/g, ' ');
  }
  const { ends, labelledStarts } = paragraphCues(pages);
  if (!ends.length && !labelledStarts.length) return bodyText;

  const { flat, pos } = project(bodyText);
  const breakAt = new Set(); // original index where a "\n\n" replaces the whitespace before it
  const labelAt = new Map(); // break index -> paragraph letter the AI dropped and we re-add

  for (const tail of ends) {
    const found = findCue(flat, tail, true);
    if (!found) continue;
    let i = pos[found.hit + found.len - 1] + 1;
    while (i < bodyText.length && /[^\sA-Za-z0-9]/.test(bodyText[i])) i++; // closing punctuation
    while (i < bodyText.length && /\s/.test(bodyText[i])) i++;
    if (i < bodyText.length) breakAt.add(i);
  }
  for (const { letter, head } of labelledStarts) {
    const found = findCue(flat, head, false);
    if (!found) continue;
    let i = pos[found.hit];
    // keep a leading "A " label attached to its paragraph; re-add it if the AI dropped it
    const before = bodyText.slice(Math.max(0, i - 3), i);
    if (/(^|\s)[A-J]\s$/.test(before)) i -= 2;
    else labelAt.set(i, letter);
    if (i > 0) breakAt.add(i);
    else if (labelAt.has(0)) breakAt.add(0);
  }

  if (!breakAt.size) return bodyText;
  let out = '';
  let last = 0;
  for (const i of [...breakAt].sort((a, b) => a - b)) {
    const label = labelAt.has(i) ? `${labelAt.get(i)} ` : '';
    out += (i > 0 ? bodyText.slice(last, i).replace(/\s+$/, '') + '\n\n' : '') + label;
    last = i;
  }
  return out + bodyText.slice(last);
}

module.exports = { restoreParagraphs };
