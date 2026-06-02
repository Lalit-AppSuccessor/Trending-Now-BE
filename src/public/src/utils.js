export const API_URL = "http://localhost:3000/api/creator/Samay_Raina/";

export function PROXY(url) {
  if (!url) return "";

  // Already proxied
  if (url.includes("/proxy?url=")) {
    return url;
  }

  return `http://localhost:3000/proxy?url=${encodeURIComponent(url)}`;
}

export const parseCount = (n) => {
  if (!n) return 0;
  const v = String(n).toLowerCase().trim();
  if (v.endsWith("m")) return parseFloat(v) * 1_000_000;
  if (v.endsWith("k")) return parseFloat(v) * 1_000;
  return Number(v) || 0;
};

export const fmtNum = (n) => {
  if (n === null || n === undefined) return "—";
  const num = parseCount(n);
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + "M";
  if (num >= 1_000) return (num / 1_000).toFixed(0) + "K";
  return Number(num).toLocaleString();
};

export const fmtDate = (iso) => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
};

export const getTimestamp = (p) => {
  if (p?.publishedAt) return Date.parse(p.publishedAt);
  if (p?.scrapedAt) return Date.parse(p.scrapedAt);
  if (p?.unixDate) return p.unixDate * 1000;
  return 0;
};

export const byLatest = (a, b) => getTimestamp(b) - getTimestamp(a);

export const getYoutubeId = (url) => {
  if (!url) return null;
  const patterns = [
    /youtube\.com\/watch\?v=([^&]+)/i,
    /youtube\.com\/shorts\/([^?&]+)/i,
    /youtube\.com\/embed\/([^?&]+)/i,
    /youtu\.be\/([^?&]+)/i,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
};

export const escHtml = (s) =>
  String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

export const PLATFORM_META = {
  facebook: { label: "Facebook", short: "FB", cls: "fb", color: "#5b9cf6" },
  instagram: { label: "Instagram", short: "IG", cls: "ig", color: "#f2698a" },
  youtube: { label: "YouTube", short: "YT", cls: "yt", color: "#ff5555" },
  shorts: { label: "Shorts", short: "Shorts", cls: "sh", color: "#a594ff" },
  twitter: { label: "X Twitter", short: "X", cls: "tw", color: "#1d9bf0" },
  news: { label: "News", short: "News", cls: "news", color: "#f0a830" },
};

/** Collect all social posts from sections and tag with platform */
export const collectSocialPosts = (sections = {}) => {
  const tag = (platform, arr = []) =>
    arr
      .filter((p) => p.text || p.caption || p.embedUrl || p.media?.length)
      .map((p) => ({ ...p, platform }));

  return [
    ...tag("facebook", sections.facebook),
    ...tag("instagram", sections.instagram),
    ...tag(
      "youtube",
      (sections.youtube || []).filter((p) => p.text || p.account),
    ),
    ...tag("shorts", sections.youtubeShorts),
    ...tag("twitter", sections.twitter),
  ].sort(byLatest);
};

/** Pick best thumbnail URL from a post */
export const getThumb = (post) => {
  if (post.thumbnailUrl) return PROXY(post.thumbnailUrl);
  if (post.thumbnail) return PROXY(post.thumbnail);
  const img = post.media?.find((m) => m.type === "image");
  if (img?.url) return PROXY(img.url);
  const vid = post.media?.find((m) => m.type === "video");
  if (vid?.poster) return PROXY(vid.poster);
  if (vid?.thumbnail) return PROXY(vid.thumbnail);
  if (post.urlToImage) return PROXY(post.urlToImage);
  if (post.image) return PROXY(post.image);
  return null;
};

/** Pick best video URL */
export const getVideoUrl = (post) => {
  const vid = post.media?.find((m) => m.type === "video");
  if (vid?.url) return vid.url;
  if (post.embedUrl) return post.embedUrl;
  return null;
};

/** Sum followers across all platforms */
export const getTotalReach = (stats = {}) => {
  let total = 0;
  if (stats.facebook?.followers) total += parseCount(stats.facebook.followers);
  if (stats.instagram?.followers)
    total += parseCount(stats.instagram.followers);
  if (stats.youtube?.subscribers)
    total += parseCount(stats.youtube.subscribers);
  if (stats.twitter?.followers) total += parseCount(stats.twitter.followers);
  return total;
};

export const getTotalPosts = (stats = {}) => {
  let total = 0;
  if (stats.facebook?.totalPosts) total += stats.facebook.totalPosts;
  if (stats.instagram?.totalPosts) total += stats.instagram.totalPosts;
  if (stats.youtube?.totalPosts) total += stats.youtube.totalPosts;
  if (stats.youtubeShorts?.totalShorts)
    total += stats.youtubeShorts.totalShorts;
  if (stats.twitter?.totalPosts) total += stats.twitter.totalPosts;
  return total;
};

/* ── TOPIC EXTRACTION ─────────────────────────────────────────── */

/** Noise words to skip when auto-generating topic labels from text */
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

/**
 * Extract trending topic labels from a list of posts.
 * Sources (in priority): explicit hashtags → category → #-tags in text → frequent nouns.
 * Returns an array of { slug, label, count } sorted by frequency, capped at MAX_TOPICS.
 */
export const extractTopics = (posts = [], maxTopics = 12) => {
  const freq = {}; // slug → { label, count, isHashtag }

  const bump = (slug, label, isHashtag = false, blockedTerms = new Set()) => {
    if (!slug || slug.length < 2 || slug.length > 30) return;

    slug = slug.toLowerCase().trim();

    if (STOP_WORDS.has(slug)) return;
    if (blockedTerms.has(slug)) return;

    if (!freq[slug]) {
      freq[slug] = {
        label,
        count: 0,
        isHashtag,
      };
    }

    freq[slug].count++;

    if (isHashtag) {
      freq[slug].isHashtag = true;
    }
  };

  posts.forEach((post) => {
    const blockedTerms = new Set(
      [post.account, post.author, post.creator, post.username, post.handle]
        .filter(Boolean)
        .map((v) => v.toLowerCase().replace(/^@/, "").trim()),
    );

    let text = `${post.text || ""} ${post.caption || ""} ${post.title || ""}`;

    // Remove account mentions from text
    blockedTerms.forEach((term) => {
      if (!term) return;

      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      text = text
        .replace(new RegExp(`@${escaped}`, "gi"), "")
        .replace(new RegExp(`\\b${escaped}\\b`, "gi"), "");
    });

    /* 1. Explicit hashtag arrays */
    if (Array.isArray(post.hashtags)) {
      post.hashtags.forEach((tag) => {
        const clean = tag.replace(/^#/, "").toLowerCase().trim();

        if (clean) {
          bump(clean, "#" + clean, true, blockedTerms);
        }
      });
    }

    /* 2. Category / topic fields */
    const cats = [post.category, post.topic].filter(Boolean);

    cats.forEach((c) => {
      const slug = c
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_]/g, "");

      const label = c
        .replace(/_/g, " ")
        .replace(/\b\w/g, (l) => l.toUpperCase());

      if (slug) {
        bump(slug, label, false, blockedTerms);
      }
    });

    /* 3. Inline hashtags */
    const inlineHashtags = text.match(/#([a-zA-Z][a-zA-Z0-9_]{1,28})/g) || [];

    inlineHashtags.forEach((tag) => {
      const clean = tag.replace(/^#/, "").toLowerCase();

      bump(clean, "#" + tag.replace(/^#/, ""), true, blockedTerms);
    });

    /* 4. Capitalised words fallback */
    if (Object.keys(freq).length < 5) {
      const words = text.match(/\b[A-Z][a-zA-Z]{2,14}\b/g) || [];

      words.forEach((w) => {
        const slug = w.toLowerCase();

        bump(slug, w, false, blockedTerms);
      });
    }
  });

  return Object.entries(freq)
    .map(([slug, v]) => ({
      slug,
      ...v,
    }))
    .sort((a, b) => {
      if (a.isHashtag !== b.isHashtag) {
        return a.isHashtag ? -1 : 1;
      }

      return b.count - a.count;
    })
    .slice(0, maxTopics);
};

/**
 * Check whether a post matches a given topic slug.
 * Checks hashtags array, category, topic field, and inline text.
 */
export const postMatchesTopic = (post, slug) => {
  if (!slug || slug === "all") return true;

  const norm = (s) => String(s || "").toLowerCase();

  /* hashtag arrays */
  if (Array.isArray(post.hashtags)) {
    if (post.hashtags.some((t) => norm(t).replace(/^#/, "") === slug))
      return true;
  }

  /* category / topic */
  const catSlug = norm(post.category)
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
  if (catSlug === slug) return true;
  const topicSlug = norm(post.topic)
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
  if (topicSlug === slug) return true;

  /* inline text */
  const fullText = `${norm(post.text)} ${norm(post.caption)} ${norm(post.title)}`;
  const re = new RegExp(
    `(^|[\\s#])${slug.replace(/_/g, "[\\s_]?")}([\\s,!.?]|$)`,
    "i",
  );
  if (re.test(fullText)) return true;

  return false;
};
