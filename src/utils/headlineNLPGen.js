import nlp from "compromise";

/* ─────────────────────────────────────────────────────────────────────────────
 * generateHeadline(posts, { creatorName, maxLen })
 *
 * Improvements over v1:
 *  - Extracts full noun PHRASES (2-4 words), not single nouns
 *  - Scores objects by specificity: proper nouns, named entities, length
 *  - Scores verbs by "interest": prefers vivid/rare verbs over generic ones
 *  - Multi-theme joining when posts cover distinct topics
 *  - Considers ALL posts in a stack (2:1:1:1 or any mix)
 * ─────────────────────────────────────────────────────────────────────────────*/

// ── Stop sets ─────────────────────────────────────────────────────────────────

const _STOP_NOUNS = new Set([
  "video",
  "videos",
  "post",
  "posts",
  "content",
  "things",
  "something",
  "anything",
  "everyone",
  "people",
  "person",
  "time",
  "times",
  "day",
  "days",
  "week",
  "weeks",
  "year",
  "years",
  "month",
  "months",
  "way",
  "ways",
  "part",
  "parts",
  "thing",
  "place",
  "places",
  "fact",
  "facts",
  "lot",
  "lots",
  "bit",
  "bits",
  "one",
  "ones",
  "latest",
  "big",
  "great",
  "good",
  "best",
  "full",
  "live",
  "coming",
  "soon",
  "news",
  "breaking",
  "watch",
  "subscribe",
  "comment",
  "share",
  "youtuber",
  "comedian",
  "host",
  "creator",
  "anchor",
  "rapper",
  "actor",
  "actress",
  "model",
  "show",
  "moment",
  "moments",
  "life",
  "world",
  "india",
  "update",
  "episode",
  "reel",
  "clip",
  "reaction",
  "look",
  "question",
  "answer",
]);

// Generic verbs — not useful in a headline
const _STOP_VERBS = new Set([
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "watch",
  "go",
  "come",
  "get",
  "want",
  "need",
  "stop",
  "make",
  "take",
  "put",
  "let",
  "read",
  "try",
  "say",
  "tell",
  "know",
  "see",
  "look",
  "seem",
  "feel",
  "find",
  "give",
  "keep",
  "turn",
  "show",
  "talk",
  "move",
  "start",
  "end",
  "run",
  "ask",
  "use",
  "like",
  "think",
  "call",
  "play",
  "stand",
  "walk",
  "sit",
  "set",
  "hold",
  "lead",
  "become",
  "follow",
  "continue",
  "build",
  "create",
  "share",
  "post",
  "appear",
  "grow",
  "hit",
]);

// ── Helpers ───────────────────────────────────────────────────────────────────

const _norm = (s = "") =>
  s
    .replace(/[.,!?:;"""]+$/, "")
    .replace(/^[.,!?:;"""]+/, "")
    .replace(/'s$/i, "")
    .trim();

const _clean = (text = "") =>
  text
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/#\w+/g, " ")
    .replace(/@\w+/g, " ")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, " ")
    .replace(/image courtesy.*$/gim, " ")
    .replace(/[|•*_~`]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

const _cap = (s = "") => s.charAt(0).toUpperCase() + s.slice(1);

const _isProperWord = (w) => /^[A-Z][a-z]/.test(w);

const _wordSet = (s = "") =>
  new Set(
    s
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 1),
  );

// Soft overlap: do phrase A and phrase B share a meaningful word?
const _overlaps = (a, b) => {
  const wa = _wordSet(a);
  return b
    .toLowerCase()
    .split(/\s+/)
    .some((w) => w.length > 3 && wa.has(w));
};

// ── Phrase-level specificity scoring ─────────────────────────────────────────
//
// A phrase earns points for:
//  +3  each proper-cased word  (named entity signal)
//  +2  each word > 5 chars     (specific vocabulary)
//  +1  each non-stop word      (base credit)
//  -3  each stop-noun word     (penalise vague phrases)
//  ×1.4 if phrase has ≥2 words (prefer multi-word topics)

function _phraseScore(phrase, subjectWords = new Set()) {
  const words = phrase.trim().split(/\s+/);
  let score = 0;
  for (const w of words) {
    const wl = w.toLowerCase();
    if (subjectWords.has(wl)) {
      score -= 5;
      continue;
    } // punish subject echo
    if (_STOP_NOUNS.has(wl)) {
      score -= 3;
      continue;
    }
    if (_isProperWord(w)) score += 3;
    if (w.length > 5) score += 2;
    score += 1;
  }
  if (words.length >= 2) score *= 1.4;
  return score;
}

// ── Verb interest score ───────────────────────────────────────────────────────
//
// Prefer vivid/specific verbs. Bonus for verbs with clear subject-action
// meaning like "roasts", "reveals", "slams", "reacts", "navigates", etc.

const _VIVID_BONUS = new Set([
  "roast",
  "roasts",
  "slam",
  "slams",
  "reveal",
  "reveals",
  "react",
  "reacts",
  "call",
  "calls",
  "expose",
  "exposes",
  "respond",
  "responds",
  "navigate",
  "navigates",
  "mock",
  "mocks",
  "criticise",
  "criticises",
  "criticize",
  "criticizes",
  "unfilter",
  "unfilters",
  "spark",
  "sparks",
  "joke",
  "jokes",
  "prove",
  "proves",
  "bond",
  "bonds",
  "spark",
  "sparks",
  "debate",
  "debates",
  "support",
  "supports",
  "celebrate",
  "celebrates",
  "return",
  "returns",
  "reunite",
  "reunites",
  "surprise",
  "surprises",
  "reminisce",
  "reminisces",
  "warn",
  "warns",
  "address",
  "addresses",
  "tackle",
  "tackles",
  "face",
  "faces",
]);

function _verbScore(verb) {
  const vl = verb.toLowerCase();
  if (_STOP_VERBS.has(vl)) return -10;
  let score = verb.length > 4 ? 2 : 1;
  if (_VIVID_BONUS.has(vl)) score += 4;
  return score;
}

// ── Extract ranked noun phrases from text ────────────────────────────────────
//
// Uses compromise's #Noun+ pattern for multi-word phrases,
// then filters and scores them.

function _extractPhrases(text, subjectWords) {
  const doc = nlp(text);

  // Multi-word noun phrases via tag pattern
  const nounPhrases = doc
    .match("#Noun+") // 1+ consecutive noun tokens
    .out("array")
    .map(_norm)
    .filter((p) => p && p.length > 2);

  // Also grab named entities separately for higher recall
  const entities = [
    ...doc.people().out("array"),
    ...(doc.organizations?.().out("array") ?? []),
    ...doc.places().out("array"),
  ]
    .map(_norm)
    .filter(Boolean);

  const all = [...new Set([...nounPhrases, ...entities])];

  return all
    .filter((p) => {
      const words = p.split(/\s+/);
      if (words.length > 5) return false; // too long = fragment
      if (/^the\s/i.test(p)) return false; // "the X" fragments
      if (_STOP_NOUNS.has(p.toLowerCase())) return false;
      return true;
    })
    .map((p) => ({ phrase: p, score: _phraseScore(p, subjectWords) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);
}

// ── Extract best verb from text ───────────────────────────────────────────────

function _extractBestVerb(text) {
  const doc = nlp(text);
  return (
    doc
      .verbs()
      .toPresent()
      .out("array")
      .map(_norm)
      .filter((v) => v && v.length > 2)
      .map((v) => ({ verb: v, score: _verbScore(v) }))
      .sort((a, b) => b.score - a.score)[0]?.verb || null
  );
}

// ── Pick top-N items by freq × score ─────────────────────────────────────────

function _topPhrases(scoredItems, n, subjectWords, usedPhrases = []) {
  const freq = {};
  const scoreMap = {};
  for (const { phrase, score } of scoredItems) {
    const k = phrase.toLowerCase();
    freq[k] = (freq[k] || 0) + 1;
    scoreMap[k] = Math.max(scoreMap[k] || 0, score);
  }

  const ranked = Object.entries(freq)
    .map(([k, f]) => ({ key: k, combined: f * scoreMap[k] }))
    .sort((a, b) => b.combined - a.combined);

  const results = [];
  // Restore original casing from the first occurrence
  const phraseMap = {};
  for (const { phrase } of scoredItems) {
    const k = phrase.toLowerCase();
    if (!phraseMap[k]) phraseMap[k] = phrase;
  }

  for (const { key } of ranked) {
    const phrase = phraseMap[key] || key;

    // Skip if overlaps with subject
    if ([...subjectWords].some((w) => w.length > 3 && _overlaps(phrase, w)))
      continue;
    // Skip if overlaps with already chosen phrases or used phrases
    if (results.some((r) => _overlaps(r, phrase))) continue;
    if (usedPhrases.some((r) => _overlaps(r, phrase))) continue;

    results.push(phrase);
    if (results.length === n) break;
  }
  return results;
}

// ── Multi-theme detection ─────────────────────────────────────────────────────
//
// Splits posts into "theme buckets" by dominant verb similarity.
// If the stack covers 2 clearly different action types, returns 2 themes.

function _detectThemes(posts, subjectWords) {
  const themes = [];

  for (const post of posts) {
    const text = _clean(post.normalizedText || "");
    if (!text) continue;
    const verb = _extractBestVerb(text);
    const phrases = _extractPhrases(text, subjectWords);
    if (!verb && !phrases.length) continue;

    // Try to merge into existing theme (same/similar verb)
    let merged = false;
    for (const theme of themes) {
      if (
        theme.verb &&
        verb &&
        theme.verb.toLowerCase() === verb.toLowerCase()
      ) {
        theme.phrases.push(...phrases);
        theme.count++;
        merged = true;
        break;
      }
    }
    if (!merged) {
      themes.push({ verb, phrases: [...phrases], count: 1 });
    }
  }

  // Sort themes by post count desc
  return themes.sort((a, b) => b.count - a.count);
}

// ── Build one sentence for a single theme ────────────────────────────────────
//
// subject  "Samay Raina"
// theme    { verb: "roasts", phrases: [...], count: 2 }
// used     already-picked phrase strings (to avoid repetition across sentences)

function _buildSentence(subject, theme, used = []) {
  const subjectWords = _wordSet(subject || "");
  const objs = _topPhrases(theme.phrases, 2, subjectWords, used);

  if (!objs.length && !theme.verb) return null;

  // e.g. "Samay Raina roasts Bharti Singh and Badshah"
  if (theme.verb && objs.length >= 2) {
    return _cap(`${subject} ${theme.verb} ${objs[0]} and ${objs[1]}`);
  }
  if (theme.verb && objs.length === 1) {
    return _cap(`${subject} ${theme.verb} ${objs[0]}`);
  }
  if (theme.verb && !objs.length) {
    return _cap(`${subject} ${theme.verb}`);
  }
  // No verb — fall back to "talks about"
  return _cap(`${subject} talks about ${objs.join(" and ")}`);
}

// ── Assemble a short paragraph — one sentence per distinct theme ──────────────
//
// Each theme that has a meaningfully different verb gets its own sentence.
// Themes that are too similar to the dominant one are merged into sentence 1.
// maxSentences caps the paragraph so it stays scannable (default 3).

function _assemble(subject, themes, maxLen, maxSentences = 3) {
  const sentences = [];
  const usedPhrases = []; // track objects already mentioned

  for (const theme of themes.slice(0, maxSentences)) {
    // Skip themes whose verb is already covered by a previous sentence
    const alreadyCovered = sentences.some(
      (s) => theme.verb && s.toLowerCase().includes(theme.verb.toLowerCase()),
    );
    if (alreadyCovered) continue;

    const sentence = _buildSentence(subject, theme, usedPhrases);
    if (!sentence) continue;

    sentences.push(sentence);

    // Register the objects from this sentence as "used"
    const topObjs = _topPhrases(
      theme.phrases,
      2,
      _wordSet(subject || ""),
      usedPhrases,
    );
    usedPhrases.push(...topObjs);

    if (sentences.length === maxSentences) break;
  }

  if (!sentences.length) return "";

  // Join into paragraph; trim the whole thing to maxLen if needed
  let para = sentences
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (para.length <= maxLen) return para;

  // Progressively drop sentences from the end until it fits
  for (let i = sentences.length - 1; i > 0; i--) {
    para = sentences.slice(0, i).join(" ").trim();
    if (para.length <= maxLen) return para;
  }

  // Hard-truncate single sentence as last resort
  const cut = sentences[0].slice(0, maxLen);
  const sp = cut.lastIndexOf(" ");
  return (sp > 40 ? cut.slice(0, sp) : cut) + "…";
}

// ── Generation Function ────────────────────────────────────────────────────────────────

export const generateHeadline = (
  posts = [],
  { creatorName = "", maxLen = 300, maxSentences = 3 } = {},
) => {
  if (!posts.length) return;
  posts = posts.filter(Boolean);

  const validTexts = posts
    .map((p) => _clean(p?.normalizedText || ""))
    .filter((t) => t.length > 4);

  if (!validTexts.length) return "";

  // ── 1. Resolve subject ──────────────────────────────────────────────────
  let subject = creatorName || null;

  if (!subject) {
    // Infer from most frequent proper noun across all texts
    const doc = nlp(validTexts.join(". "));
    const people = doc.people().out("array").map(_norm).filter(Boolean);
    const orgs = (doc.organizations?.().out("array") ?? [])
      .map(_norm)
      .filter(Boolean);
    const allProper = doc
      .nouns()
      .out("array")
      .map(_norm)
      .filter((n) => n.split(/\s+/).every(_isProperWord));

    const freq = {};
    for (const n of [...people, ...orgs, ...allProper]) {
      const k = n.toLowerCase();
      freq[k] = (freq[k] || 0) + 1;
    }
    subject =
      Object.entries(freq).sort(([, a], [, b]) => b - a)[0]?.[0] || null;
    if (subject) subject = _cap(subject);
  }

  const subjectWords = _wordSet(subject || "");

  // ── 2. Detect themes across ALL posts in the stack ──────────────────────
  const themes = _detectThemes(posts, subjectWords);

  if (!themes.length) {
    // Fallback: just return the richest single sentence
    const fallback =
      validTexts
        .map((t) => ({ t, score: _phraseScore(t, subjectWords) }))
        .sort((a, b) => b.score - a.score)[0]?.t || validTexts[0];
    return _cap(fallback.slice(0, maxLen));
  }

  // ── 3. Assemble paragraph ───────────────────────────────────────────────
  return _assemble(subject, themes, maxLen, maxSentences);
};
