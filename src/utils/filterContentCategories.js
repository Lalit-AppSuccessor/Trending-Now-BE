import {
  BLOCKED_WORDS,
  HANDLES,
  NEWS_KEYWORDS,
} from "../constants/keywords.js";

const NEWS_SOURCES = [
  "aajtak",
  "newstak",
  "indiatoday",
  "thelallantop",
  "lallantop",
  "news18",
  "cnnnews18",
  "indiatv",
  "abp",
  "abpnews",
  "zeenews",
  "zeebharat",
  "timesnow",
  "timesnownavbharat",
  "republic",
  "republicbharat",
  "tv9",
  "ndtv",
  "hindustan times",
  "the indian express",
  "indian express",
  "the print",
  "the quint",
  "firstpost",
  "dna",
  "pti",
  "ani",
  "newslaundry",
  "opindia",
  "reuters",
  "associated press",
  "ap news",
  "bbc",
  "cnn",
  "fox news",
  "al jazeera",
];

const HARD_NEWS = [
  // Legal
  "fir",
  "court",
  "supreme court",
  "high court",
  "lawsuit",
  "legal",
  "legal action",
  "petition",
  "summons",
  "notice",
  "judge",
  "hearing",
  "verdict",
  "court order",
  "quashed fir",

  // Crime
  "police",
  "investigation",
  "under investigation",
  "crime branch",
  "cyber cell",
  "arrest",
  "detained",
  "custody",
  "bail",
  "chargesheet",
  "criminal proceedings",

  // Controversies
  "controversy",
  "controversial",
  "backlash",
  "boycott",
  "cancelled",
  "cancel culture",
  "scandal",
  "allegation",
  "allegedly",
  "accused",
  "called out",
  "slammed",
  "exposed",

  // Sensitive
  "death",
  "hospital",
  "accident",
  "injury",
  "fraud",
  "scam",
  "hack",
  "leaked",
  "leak",
  "threat",
  "attack",

  // Elvish
  "snake venom",
  "snake venom case",
  "wildlife protection act",
  "ndps",

  // Creator controversies
  "orry row",
  "influencer drama",
  "viral controversy",

  // Breaking
  "breaking news",
  "exclusive",
  "sunil pal",
  "Amitabh Bachchan",
  "powerfull",
  "roast",
  "unpredictable",
  "storm",
  "breaking",
  "internet",
  "indian news",
  "news media",
  "dominate",
  "intense",
  "drops",
  "silence",
  "stunned",
  "sarcastic",
  "humour",
  "expose",
  "CJP",
  "Cocokroach janta party",
  "janta",
  "anti",
  "BJP",
  "mess",
  "cringiest",
  "reveals",
  "was right",
  "harsh",
  "truth",
  "slogans",
  "faces off",
  "haddiyan",
  "hindus",
  "support",
  "reunite",
];

const STRONG_NEWS = [
  "controversy",
  "fir",
  "court",
  "supreme court",
  "high court",
  "legal",
  "police",
  "investigation",
  "arrest",
  "backlash",
  "boycott",
  "scandal",
  "allegation",
  "accused",
  "lawsuit",
  "chargesheet",
  "crime branch",
  "cyber cell",
  "snake venom",
  "wildlife protection act",
  "ndps",
];

export function getCategory(item) {
  const text = [
    item.title,
    item.description,
    item.content,
    item.text,
    item.caption,
    ...(item.hashtags || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const source = (item.source?.name || item.account || "").toLowerCase();

  // ============================================
  // 1. NEWS CHANNELS
  // ============================================

  if (NEWS_SOURCES.some((channel) => source.includes(channel))) {
    return "news";
  }

  // ============================================
  // 2. HARD NEWS
  // ============================================

  if (HARD_NEWS.some((keyword) => text.includes(keyword))) {
    return "news";
  }

  // ============================================
  // 3. STRICT NEWS MATCHING
  // Need multiple strong signals
  // ============================================

  let strongMatches = 0;

  for (const keyword of STRONG_NEWS) {
    if (text.includes(keyword)) {
      strongMatches++;
    }
  }

  if (strongMatches >= 2) {
    return "news";
  }

  // ============================================
  // 4. Generic NEWS keywords
  // Need many matches to qualify
  // ============================================

  let newsMatches = 0;

  for (const keyword of NEWS_KEYWORDS) {
    if (text.includes(keyword.toLowerCase())) {
      newsMatches++;
    }
  }

  if (newsMatches >= 5) {
    return "news";
  }

  // ============================================
  // 5. Breaking flag
  // ============================================

  if (item.isBreaking === true) {
    return "news";
  }

  // ============================================
  // 6. Everything else = lifestyle
  // ============================================

  return "lifestyle";
}

/**
 * Extract trending topic labels from a list of posts.
 * Count always equals the number of posts that will actually appear
 * when filtering by that topic.
 */

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
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
  "is",
  "are",
  "was",
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
  "shall",
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
  "this",
  "that",
  "these",
  "those",
  "my",
  "your",
  "his",
  "its",
  "our",
  "their",
  "what",
  "which",
  "who",
  "how",
  "when",
  "where",
  "why",
  "not",
  "no",
  "yes",
  "so",
  "if",
  "as",
  "by",
  "up",
  "out",
  "from",
  "into",
  "just",
  "also",
  "very",
  "all",
  "some",
  "any",
  "can",
  "new",
  "one",
  "two",
  "more",
  "get",
  "got",
  "like",
  "go",
  "going",
  "come",
  "see",
  "know",
  "think",
  "time",
  "day",
  "now",
  "back",
  "want",
  "make",
  "use",
  "take",
  "give",
  "good",
  "great",
  "really",
  "much",
  "re",
  "ve",
  "ll",
  "t",
  "s",
  "d",
  "m",
  "amp",
  "https",
  "http",
  "www",
]);

const normalizeText = (text = "") =>
  text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "")
    .replace(/@\w+/g, "")
    .replace(/#\w+/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Check whether a post matches a given topic slug.
 */
export const postMatchesTopic = (post, slug) => {
  if (!slug || slug === "all") return true;

  const target = String(slug).toLowerCase().trim();

  const normalizeTopic = (value) =>
    String(value || "")
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");

  const text = `${post.text || ""} ${post.caption || ""} ${post.title || ""} ${post.content || ""} ${post.description || ""} ${post.normalizedText || ""}`;

  const searchableText = normalizeText(text);

  const escapedSlug = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const wordBoundaryRegex = new RegExp(
    `(^|\\W)${escapedSlug.replace(/_/g, "[\\s_]+")}(\\W|$)`,
    "i",
  );

  const wordCheck = wordBoundaryRegex.test(searchableText);

  if (wordCheck) {
    return true;
  }

  /* hashtags array */
  if (Array.isArray(post.hashtags)) {
    if (
      post.hashtags.some(
        (tag) => normalizeTopic(String(tag).replace(/^#/, "")) === target,
      )
    ) {
      return true;
    }
  }

  /* topic */
  if (normalizeTopic(post.topic) === target) {
    return true;
  }

  /* inline hashtags */
  const inlineHashtags = text.match(/#([a-zA-Z][a-zA-Z0-9_]{1,28})/g) || [];

  if (
    inlineHashtags.some(
      (tag) => normalizeTopic(tag.replace(/^#/, "")) === target,
    )
  ) {
    return true;
  }
  return false;
};

export const extractTopics = (creatorName, posts = []) => {
  const freq = {};

  posts.forEach((post) => {
    const creator = creatorName
      ? creatorName.toLowerCase().split("_").join("")?.replace(/^@/, "").trim()
      : null;

    const creatorFirstName = creatorName
      ? creatorName.toLowerCase().split("_")[0]?.replace(/^@/, "").trim()
      : null;

    const creatorLastName = creatorName
      ? creatorName.toLowerCase().split("_")[1]?.replace(/^@/, "").trim()
      : null;

    const creatorHandles = HANDLES[creatorName];
    const blockedWords = BLOCKED_WORDS;

    const blockedTerms = new Set(
      [
        post.account,
        post.author,
        post.creator,
        post.username,
        post.handle,
        creator,
        creatorFirstName,
        creatorLastName,
        ...creatorHandles,
        ...blockedWords,
      ]
        .filter(Boolean)
        .map((v) => v.toLowerCase().replace(/^@/, "").trim()),
    );

    let text = `${post.text || ""} ${post.caption || ""} ${post.title || ""} ${post.content || ""} ${post.description || ""} ${post.normalizedText || ""}`;

    blockedTerms.forEach((term) => {
      if (!term) return;

      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      text = text
        .replace(new RegExp(`@${escaped}`, "gi"), "")
        .replace(new RegExp(`\\b${escaped}\\b`, "gi"), "");
    });

    const postTopics = new Map();

    const addPostTopic = (slug, label, isHashtag = false) => {
      if (!slug) return;

      slug = slug.toLowerCase().trim();

      if (
        slug.length < 4 ||
        slug.length > 30 ||
        STOP_WORDS.has(slug) ||
        blockedTerms.has(slug)
      ) {
        return;
      }

      const existing = postTopics.get(slug);

      postTopics.set(slug, {
        label: existing?.label || label,
        isHashtag: existing?.isHashtag || isHashtag,
      });
    };

    /* hashtags array */
    if (Array.isArray(post.hashtags)) {
      post.hashtags.forEach((tag) => {
        const clean = String(tag).replace(/^#/, "").toLowerCase().trim();

        if (clean && clean.length > 4) {
          addPostTopic(clean, `#${clean}`, true);
        }
      });
    }

    /* inline hashtags */
    const inlineHashtags = text.match(/#([a-zA-Z][a-zA-Z0-9_]{1,28})/g) || [];

    inlineHashtags.forEach((tag) => {
      const clean = tag.replace(/^#/, "").toLowerCase();
      if (clean.length <= 4) {
        return;
      }
      addPostTopic(clean, `#${clean}`, true);
    });

    /* count each topic per post */
    postTopics.forEach((topic, slug) => {
      if (!freq[slug]) {
        freq[slug] = {
          label: topic.label,
          count: 0,
          isHashtag: topic.isHashtag,
        };
      }

      freq[slug].count += 1;

      if (topic.isHashtag) {
        freq[slug].isHashtag = true;
      }
    });
  });

  posts.forEach((post) => {
    let bestTopic = null;

    Object.entries(freq).forEach(([slug, value]) => {
      if (postMatchesTopic(post, slug)) {
        if (!bestTopic || value.count > bestTopic.count) {
          bestTopic = {
            slug,
            label: value.label,
            isHashtag: value.isHashtag,
            count: value.count,
          };
        }
      }
    });

    if (bestTopic) {
      post.topic = bestTopic.slug;
      post.topicMeta = bestTopic;
    }
  });

  return posts;
};

export const addTopicsToPosts = (creatorName, posts = []) => {
  if (!Array.isArray(posts) || posts.length === 0) {
    return [];
  }

  return extractTopics(creatorName, posts);
};
