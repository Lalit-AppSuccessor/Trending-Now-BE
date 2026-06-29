import { generateHeadline } from "./headlineNLPGen.js";

export function collectPosts(data) {
  const posts = [];

  (data?.sections?.news || []).forEach((p) =>
    posts.push({
      ...p,
      platform: "news",
    }),
  );

  const platforms = [
    "instagram",
    "twitter",
    "facebook",
    "youtube",
    "youtube_shorts",
    "youtubeShorts",
    "shorts",
  ];

  platforms.forEach((platform) => {
    const section = data?.sections?.[platform];

    const arr = Array.isArray(section) ? section : section?.posts || [];

    arr.forEach((p) =>
      posts.push({
        ...p,
        platform:
          platform === "youtubeShorts" || platform === "shorts"
            ? "youtube_shorts"
            : platform,
      }),
    );
  });

  return posts;
}

/* ── vocabulary sets ──────────────────────────────────────── */

const STOP = new Set([
  "bro",
  "bros",
  "guys",
  "guy",
  "yaar",
  "omg",
  "wow",
  "lol",
  "lmao",
  "haha",
  "hehe",
  "actually",
  "basically",
  "literally",
  "seriously",
  "honestly",
  "really",
  "absolutely",
  "totally",
  "simply",
  "maybe",
  "perhaps",
  "probably",
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "with",
  "by",
  "from",
  "as",
  "is",
  "was",
  "are",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "must",
  "shall",
  "can",
  "this",
  "that",
  "these",
  "those",
  "i",
  "you",
  "he",
  "she",
  "it",
  "we",
  "they",
  "me",
  "him",
  "her",
  "us",
  "them",
  "my",
  "your",
  "his",
  "its",
  "our",
  "their",
  "what",
  "which",
  "who",
  "when",
  "where",
  "why",
  "how",
  "all",
  "any",
  "both",
  "each",
  "few",
  "more",
  "most",
  "other",
  "some",
  "such",
  "no",
  "not",
  "only",
  "same",
  "so",
  "than",
  "too",
  "very",
  "just",
  "into",
  "after",
  "before",
  "over",
  "under",
  "about",
  "up",
  "out",
  "down",
  "off",
  "also",
  "now",
  "here",
  "there",
  "while",
  "during",
  "across",
  "through",
  "against",
  "between",
  "within",
  "without",
  "following",
  "amid",
  "despite",
  "per",
  "via",
  "among",
  "even",
  "still",
  "well",
  "back",
  "then",
  "since",
  "until",
  "never",
  "ever",
  "always",
  "already",
  "again",
  "re",
  "dont",
  "cant",
  "wont",
  "im",
  "ive",
  "theyre",
  "weve",
  "youre",
  "hes",
  "shes",
  "isnt",
  "arent",
  "wasnt",
  "werent",
  "hasnt",
  "havent",
  "hadnt",
  "didnt",
  "doesnt",
  "wont",
  "lets",
  "get",
  "got",
  "go",
  "goes",
  "went",
  "come",
  "came",
  "say",
  "says",
  "said",
  "tell",
  "told",
  "put",
  "take",
  "took",
  "see",
  "saw",
  "know",
  "knew",
  "like",
  "want",
  "need",
  "use",
  "used",
  "give",
  "gave",
  "find",
  "found",
  "think",
  "thought",
  "look",
  "looked",
  "let",
  "call",
  "try",
  "keep",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "vs",
  "ft",
  "its",
  "rt",
  "amp",
  "via",
]);

const GLUE = new Set([
  "a",
  "an",
  "the",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "with",
  "by",
  "from",
  "into",
  "over",
  "after",
  "and",
  "amid",
  "as",
  "up",
  "out",
  "back",
  "during",
  "its",
  "his",
  "her",
  "their",
  "our",
  "between",
  "across",
  "about",
]);

const VERBS = new Set([
  // creator / entertainment
  "exposes",
  "exposed",
  "addresses",
  "addressed",
  "discusses",
  "discussed",
  "questions",
  "questioned",
  "accuses",
  "accused",
  "supports",
  "supported",
  "criticises",
  "criticized",
  "criticises",
  "criticises",
  "blasts",
  "blasted",
  "targets",
  "targeted",
  "debunks",
  "debunked",
  "explains",
  "explained",
  "clarifies",
  "clarified",
  "highlights",
  "highlighted",

  // social media
  "goes",
  "went",
  "sparks",
  "sparked",
  "ignites",
  "ignited",
  "draws",
  "drew",
  "attracts",
  "attracted",
  "captures",
  "captured",
  "stuns",
  "stunned",
  "surprises",
  "surprised",

  // controversy
  "controversy",
  "controversial",
  "bashes",
  "bashed",
  "roasts",
  "roasted",
  "trolls",
  "trolled",
  "mocks",
  "mocked",
  "praises",
  "praised",
  "supports",
  "supported",

  // business / creator
  "partners",
  "partnered",
  "invests",
  "invested",
  "promotes",
  "promoted",
  "unveils",
  "unveiled",
  "debuts",
  "debuted",

  // present / base
  "wins",
  "breaks",
  "sets",
  "hits",
  "drops",
  "reveals",
  "launches",
  "joins",
  "beats",
  "surpasses",
  "crosses",
  "reaches",
  "announces",
  "confirms",
  "responds",
  "returns",
  "exits",
  "leads",
  "tops",
  "dominates",
  "trends",
  "sells",
  "challenges",
  "shares",
  "posts",
  "streams",
  "plays",
  "performs",
  "releases",
  "gains",
  "earns",
  "scores",
  "claims",
  "faces",
  "opens",
  "rises",
  "falls",
  "makes",
  "takes",
  "shows",
  "reacts",
  "defends",
  "attacks",
  "slams",
  "praises",
  "calls",
  "denies",
  "admits",
  "speaks",
  "fires",
  "quits",
  "signs",
  "stands",
  "fights",
  "breaks",
  "builds",
  "pushes",
  "pulls",
  "runs",
  "hits",
  "brings",
  "holds",
  "keeps",
  "gets",
  "loses",
  "starts",
  "ends",
  "returns",
  "catches",
  "clears",
  "creates",
  "grows",
  "helps",
  "leaves",
  "moves",
  "plays",
  "proves",
  "pulls",
  "serves",
  "speaks",
  "stays",
  "turns",
  "works",
  "writes",
  "drops",
  "shoots",
  "throws",
  "sets",
  // past
  "won",
  "lost",
  "broke",
  "sold",
  "made",
  "gave",
  "hit",
  "dropped",
  "revealed",
  "launched",
  "joined",
  "beat",
  "reached",
  "announced",
  "confirmed",
  "responded",
  "returned",
  "crossed",
  "dominated",
  "trended",
  "gained",
  "earned",
  "claimed",
  "opened",
  "rose",
  "fell",
  "shown",
  "shared",
  "posted",
  "performed",
  "released",
  "reacted",
  "defended",
  "slammed",
  "praised",
  "denied",
  "admitted",
  "spoken",
  "quit",
  "fired",
  "ran",
  "grew",
  "moved",
  "stayed",
  "turned",
  "worked",
  "wrote",
  // present-progressive / adjectives that feel action-like
  "trending",
  "streaming",
  "winning",
  "breaking",
  "going",
  "viral",
  "rising",
  "falling",
  "dominating",
  "leading",
  "selling",
  "gaining",
  "earning",
  "scoring",
  "performing",
  "challenging",
  "defending",
  "slamming",
  "praising",
  "achieving",
  "celebrating",
  "returning",
  "launching",
  "reaching",
]);

const BAD_PHRASES = [
  "full story",
  "full video",
  "watch till end",
  "link in bio",
  "new lafda",
  "literally me",
  "image courtesy",
  "podcast length",
  "part 1",
  "part 2",
  "part 3",
  "must watch",
  "don't miss",
  "dont miss",
  "wait for it",
  "swipe left",
  "swipe right",
  "9th slide",
  "10th slide",
];
const BAD_STARTS = new Set([
  "omg",
  "wow",
  "bro",
  "meanwhile",
  "look",
  "look at",
  "first",
  "second",
  "third",
  "fourth",
  "next",
  "next morning",
  "yaar",
  "so",
  "then",
  "and",
  "but",
  "because",
  "when",
  "why",
  "how",
  "what",
]);
const BAD_HEADLINE_WORDS = new Set([
  "omg",
  "wow",
  "bro",
  "bros",
  "lol",
  "lmao",
  "haha",
  "hehe",
  "cute",
  "adorable",
  "lafda",
  "crush",
  "dating",
  "girlfriend",
  "boyfriend",
  "relationship",
  "couple",
  "ship",
  "vibes",
  "mood",
  "literally",
  "seriously",
  "honestly",
  "basically",
  "actually",
  "yaar",
  "bhai",
  "op",
  "insane",
  "crazy",
  "epic",
  "wholesome",
  "beautiful",
  "handsome",
  "stunning",
  "gorgeous",
]);
const GOOD_HEADLINE_WORDS = new Set([
  "announcement",
  "announces",
  "confirmed",
  "confirms",
  "response",
  "responds",
  "reaction",
  "reacts",
  "statement",
  "reveals",
  "revealed",
  "launches",
  "launched",
  "returns",
  "returned",
  "joins",
  "joined",
  "wins",
  "won",
  "victory",
  "milestone",
  "record",
  "achievement",
  "award",
  "champion",
  "tournament",
  "match",
  "podcast",
  "interview",
  "discussion",
  "controversy",
  "controversial",
  "criticism",
  "criticises",
  "criticized",
  "slams",
  "slammed",
  "addresses",
  "addressed",
  "clarifies",
  "clarified",
  "debunks",
  "debunked",
  "investigation",
  "report",
  "reports",
  "update",
  "breaking",
  "viral",
  "trending",
  "record-breaking",
  "historic",
  "official",
  "major",
  "exclusive",
]);

const displayName = (slug) => slug.replace(/_/g, " ");

function tokenise(text) {
  return text
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/#\w+/g, " ")
    .replace(/@\w+/g, " ")
    .replace(/[^\w\s\-']/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((t) => t.length >= 2);
}

function cleanHeadlineSource(text = "") {
  return (
    text
      // hashtags
      .replace(/#\w+/g, " ")

      // mentions
      .replace(/@\w+/g, " ")

      // [tag lists]
      .replace(/\[[^\]]+\]/g, " ")

      // image credit
      .replace(/image courtesy.*$/gim, " ")

      // podcast metadata
      .replace(/podcast length\s*:\s*.*$/gim, " ")

      // slide references
      .replace(/\b\d+(st|nd|rd|th)\s+slide\b.*$/gim, " ")

      // quoted filenames / leak names
      .replace(/"[A-Z0-9_]{10,}[^"]*"/g, " ")

      // long comma-separated keyword dumps
      .replace(/\b(?:[a-z][a-z\s&-]*,\s*){4,}[a-z][a-z\s&-]*\b/gim, " ")

      // emojis
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, " ")

      .replace(/\s+/g, " ")
      .trim()
  );
}

function extractHeadlineCandidates(text) {
  if (!text) return [];

  text = cleanHeadlineSource(text);

  return text
    .replace(/https?:\/\/\S+/gi, "")
    .split(/[.!?•\n\r]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => s.length > 20);
}

function cleanHeadline(text) {
  return text
    .replace(/^[-–—:|]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreHeadline(sentence) {
  const tokens = tokenise(sentence);
  const lower = tokens.map((t) => t.toLowerCase());

  if (tokens.length < 4) return -999;

  let score = 0;

  const first = lower[0];
  const last = lower[lower.length - 1];

  const verbCount = lower.filter((w) => VERBS.has(w)).length;
  const contentCount = lower.filter((w) => !STOP.has(w) && !GLUE.has(w)).length;

  const glueCount = lower.filter((w) => GLUE.has(w)).length;

  const capCount = tokens.filter((t) => /^[A-Z]/.test(t)).length;

  const goodWordCount = lower.filter((w) => GOOD_HEADLINE_WORDS.has(w)).length;

  const badWordCount = lower.filter((w) => BAD_HEADLINE_WORDS.has(w)).length;

  if (!STOP.has(first) && !GLUE.has(first)) score += 8;
  else score -= 8;

  if (!STOP.has(last) && !GLUE.has(last)) score += 6;
  else score -= 4;

  if (verbCount > 0) score += verbCount * 10;
  else score -= 20;

  score += Math.min(contentCount * 2, 20);

  if (glueCount >= 1 && glueCount <= 3) score += 5;

  if (glueCount > 5) score -= 5;

  score += Math.min(capCount * 2, 10);

  score += goodWordCount * 8;

  score -= badWordCount * 10;

  if (contentCount >= 3 && verbCount >= 1) {
    score += 12;
  }

  if (verbCount >= 2) score += 5;

  if (tokens.length >= 5 && tokens.length <= 11) {
    score += 10;
  } else if (tokens.length <= 14) {
    score += 4;
  } else {
    score -= 10;
  }

  if (BAD_PHRASES.some((p) => sentence.toLowerCase().includes(p))) {
    score -= 30;
  }

  if (BAD_STARTS.has(first)) {
    score -= 25;
  }

  if (sentence.includes("?")) score -= 15;

  const upperWords = tokens.filter(
    (t) => t.length > 3 && t === t.toUpperCase(),
  ).length;

  if (upperWords >= 2) score -= 20;

  const numericCount = tokens.filter((t) => /\d/.test(t)).length;

  if (numericCount >= 3) score -= 15;

  if (/^\d/.test(tokens[0])) score -= 20;

  if (sentence.includes("|")) score -= 15;

  if (sentence.includes(":")) score -= 10;

  return score;
}

function looksLikeHeadline(text) {
  const words = text.split(/\s+/);

  if (words.length < 4) return false;
  if (words.length > 15) return false;

  if (/[#@]/.test(text)) return false;

  if (
    /^[Kk]ya\b/.test(text) ||
    /^[Kk]aise\b/.test(text) ||
    /^[Ww]hy\b/.test(text) ||
    /^[Hh]ow\b/.test(text) ||
    /^[Ww]hat\b/.test(text) ||
    /^[Ww]hen\b/.test(text)
  ) {
    return false;
  }

  if (/\b(crush|girlfriend|boyfriend|dating|relationship)\b/i.test(text)) {
    return false;
  }

  if (/\b(subscribe|follow|comment|share|like)\b/i.test(text)) {
    return false;
  }

  if (/\b(part\s*\d+|full video|link in bio|watch till end)\b/i.test(text)) {
    return false;
  }

  if (text === text.toUpperCase()) return false;

  return true;
}
/* ═══════════════════════════════════════════════════════════════
   POST STACK HEADLINE
═══════════════════════════════════════════════════════════════ */

function buildKeywordHeadline(
  creatorSlug,
  newsItems,
  igPost,
  twPost,
  shortPost,
) {
  const newsTitle = newsItems[0]?.title || newsItems[1]?.title;

  if (newsTitle && newsTitle.length > 20 && !/[#@]/.test(newsTitle)) {
    return cleanHeadline(newsTitle);
  }

  const nameWords = displayName(creatorSlug).toLowerCase().split(" ");

  const sources = [
    newsItems[0]?.title,
    newsItems[1]?.title,
    newsItems[0]?.description,
    newsItems[1]?.description,
    newsItems[0]?.content,
    newsItems[1]?.content,
    shortPost?.title,
    twPost?.text,
    shortPost?.caption,
    igPost?.caption,
  ].filter(Boolean);

  let bestHeadline = null;
  let bestScore = -Infinity;

  for (const source of sources) {
    const cleanedSource = cleanHeadlineSource(source);

    if (cleanedSource.length < 15) continue;

    const candidates = extractHeadlineCandidates(cleanedSource);

    for (let sentence of candidates) {
      if (!looksLikeHeadline(sentence)) continue;

      const words = sentence.split(" ");

      sentence = cleanHeadline(sentence);

      const score = scoreHeadline(sentence);

      if (score > bestScore) {
        bestScore = score;
        bestHeadline = sentence;
      }
    }
  }

  if (bestHeadline) {
    const words = bestHeadline.split(" ");

    return bestHeadline
      .replace(/#\w+/g, "")
      .replace(/@\w+/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  const fallbackSentence = generateHeadline(
    [...newsItems, igPost, twPost, shortPost],
    {
      creatorName: displayName(creatorSlug),
    },
  );

  return fallbackSentence;
}

/* ═══════════════════════════════════════════════════════════════
   FEEDBACK QUESTION
═══════════════════════════════════════════════════════════════ */

function buildFeedbackQuestion(creatorSlug, newsItems, topic) {
  const name = displayName(creatorSlug);
  const title = newsItems[0]?.title?.trim();
  if (title) {
    const short = title.length > 65 ? title.slice(0, 62) + "…" : title;
    return `What's your take? "${short}"`;
  }
  return `How do you feel about ${name}'s latest ${topic || "content"}?`;
}

export function StackPostMaker(creatorSlug, sortedTopics) {
  if (!sortedTopics.length) return;

  const built = [];

  for (const topic of sortedTopics) {
    // Count categories

    const categoryCounts = topic.posts.reduce((acc, post) => {
      const category = post.category;
      if (category) {
        acc[category] = (acc[category] || 0) + 1;
      }
      return acc;
    }, {});

    // Find category with maximum count
    const dominantCategory = Object.keys(categoryCounts).reduce(
      (a, b) => (categoryCounts[a] > categoryCounts[b] ? a : b),
      Object.keys(categoryCounts)[0],
    );

    // Only keep posts from dominant category
    const filteredPosts = topic.posts.filter(
      (p) => p.category === dominantCategory,
    );

    const newsItems = filteredPosts
      .filter((p) => p.platform === "news")
      .sort(
        (a, b) =>
          new Date(b.publishedAt || b.scrapedAt || 0) -
          new Date(a.publishedAt || a.scrapedAt || 0),
      )
      .slice(0, 2);

    const igPost =
      filteredPosts
        .filter((p) => p.platform === "instagram")
        .sort(
          (a, b) =>
            (b.normalizedText?.replace(/\s+/g, "").length || 0) -
            (a.normalizedText?.replace(/\s+/g, "").length || 0),
        )[0] || null;

    const twPost =
      filteredPosts
        .filter((p) => p.platform === "twitter")
        .sort(
          (a, b) =>
            (b.normalizedText?.replace(/\s+/g, "").length || 0) -
            (a.normalizedText?.replace(/\s+/g, "").length || 0),
        )[0] || null;

    const shortPost =
      filteredPosts
        .filter((p) => p.platform === "youtube_shorts")
        .sort(
          (a, b) =>
            (b.normalizedText?.replace(/\s+/g, "").length || 0) -
            (a.normalizedText?.replace(/\s+/g, "").length || 0),
        )[0] || null;

    if (!newsItems.length && !igPost && !twPost && !shortPost) {
      ++i;
      continue;
    }

    built.push({
      creatorSlug,

      topicSlug: topic.slug,
      topicLabel: topic.label,
      topicCount: topic.posts.length,

      newsItems,
      igPost,
      twPost,
      shortPost,

      topTopics: [
        {
          slug: topic.slug,
          label: topic.label,
          count: topic.posts.length,
        },
      ],

      stackCategory: dominantCategory,

      headline: buildKeywordHeadline(
        creatorSlug,
        newsItems,
        igPost,
        twPost,
        shortPost,
      ),

      feedbackQuestion: buildFeedbackQuestion(
        creatorSlug,
        newsItems,
        topic.label,
      ),
    });
  }

  built.sort((a, b) => b.topicCount - a.topicCount);
  return built;
}
