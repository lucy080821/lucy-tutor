// Kho hạt giống của Nông Trại: từ vựng theo chủ đề + THẺ NGỮ PHÁP + THẺ PHÁT ÂM (dữ liệu trong src/data/).
// Thẻ ngữ pháp/phát âm vẫn là 1 dòng VocabItem trong deck SRS (word = đáp án, meaning = gợi ý/câu hỏi, example = câu đầy đủ/giải thích,
// pos = 'grammar' | 'pron') để dùng chung lịch SM-2; phần câu hỏi nhiều lựa chọn tra lại ở đây theo (pos, word, meaning).
const VOCAB = require('../data/farmSeeds.json').map((t) => ({ ...t, kind: 'vocab' }));
const GRAMMAR = require('../data/farmGrammar.json');
const PRON = require('../data/farmPron.json');

const TOPICS = [...VOCAB, ...GRAMMAR, ...PRON];
const BY_ID = new Map(TOPICS.map((t) => [t.id, t]));
const posOfKind = (kind) => (kind === 'grammar' ? 'grammar' : kind === 'pron' ? 'pron' : null);
const keyOf = (pos, word, meaning) => `${pos}|${String(word).toLowerCase()}|${meaning}`;

const CARD_INDEX = new Map();
for (const t of [...GRAMMAR, ...PRON]) for (const w of t.words) CARD_INDEX.set(keyOf(posOfKind(t.kind), w.word, w.meaning), { ...w, topicId: t.id, kind: t.kind });

// Tra thẻ nhiều lựa chọn từ 1 VocabItem (không phải thẻ ngữ pháp/phát âm → null)
function cardOf(vocab) {
  if (!vocab || (vocab.pos !== 'grammar' && vocab.pos !== 'pron')) return null;
  return CARD_INDEX.get(keyOf(vocab.pos, vocab.word, vocab.meaning)) || null;
}
const kindOfVocab = (vocab) => (vocab && vocab.pos === 'grammar' ? 'grammar' : vocab && vocab.pos === 'pron' ? 'pron' : 'vocab');

// Tìm hạt giống trong 1 chủ đề theo id thẻ (ngữ pháp/phát âm) hoặc theo từ (từ vựng)
function findSeed(topicId, idOrWord) {
  const t = BY_ID.get(topicId); if (!t) return null;
  const q = String(idOrWord || '').toLowerCase();
  const w = t.words.find((x) => (x.id && x.id.toLowerCase() === q) || String(x.word).toLowerCase() === q);
  return w ? { topic: t, seed: w } : null;
}

module.exports = { VOCAB, GRAMMAR, PRON, TOPICS, BY_ID, CARD_INDEX, cardOf, kindOfVocab, findSeed, posOfKind, keyOf };
