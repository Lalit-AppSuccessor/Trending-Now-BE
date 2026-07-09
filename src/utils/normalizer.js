import { addTopicsToPosts, getCategory } from "./filterContentCategories.js";

// ─── Categorisation ─────────────────────────────────────────────────────────

const safe = (val, fallback = null) =>
  val !== undefined && val !== null && val !== "" ? val : fallback;

const safeInt = (val, fallback = 0) => {
  const n = parseInt(val, 10);
  return isNaN(n) ? fallback : n;
};

const safeDate = (val) => {
  if (!val) return null;
  const raw = typeof val === "object" && val.$date ? val.$date : val;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d.toISOString();
};

const safeTimestamp = (ts) => {
  if (!ts) return null;
  const ms = ts * 1000;
  const d = new Date(ms);
  return isNaN(d.getTime()) ? null : d.toISOString();
};

// Clean Instagram caption: strip username prefix + trim whitespace
const cleanCaption = (caption) => {
  if (!caption) return null;
  return (
    caption
      .replace(/^[a-zA-Z0-9._]+:\s*/, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim() || null
  );
};

const normalizeText = (text = "") =>
  text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "")
    .replace(/@\w+/g, "")
    .replace(/#\w+/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Extract clean hashtags from an array (deduplicate, normalise)
const cleanHashtags = (tags) => {
  if (!Array.isArray(tags) || tags.length === 0) return [];
  return [...new Set(tags.map((t) => t.trim().toLowerCase()))];
};

// Filter media items: strip empty urls, deduplicate by url
const cleanMedia = (mediaArr) => {
  if (!Array.isArray(mediaArr)) return [];

  const seen = new Set();

  return mediaArr
    .map((m) => ({
      ...m,
      url: (m.firebaseUrl || m.url)?.trim(),
      poster: m.firebasePoster || m.poster || null,
    }))
    .filter((m) => m && m.url)
    .filter((m) => {
      if (seen.has(m.url)) return false;
      seen.add(m.url);
      return true;
    })
    .map((m) => ({
      type: safe(m.type, "image"),
      url: m.url,
      thumbnail: m.thumbnail || null,
      poster: m.poster,
    }));
};

// Extract YouTube video ID from a URL for embedding
const ytVideoId = (url) => {
  if (!url) return null;
  const m = url.match(
    /(?:youtube\.com\/shorts\/|youtu\.be\/|v=)([a-zA-Z0-9_-]{11})/,
  );
  return m ? m[1] : null;
};

// ─── Platform Normalisers ───────────────────────────────────────────────────

function normaliseInstagram(igAccounts = []) {
  const posts = [];

  for (const p of igAccounts) {
    if (!p) continue;

    const caption = cleanCaption(p.caption);

    posts.push({
      id: safe(p.shortcode || p.postId),
      postId: safe(p.postId),

      platform: "instagram",

      account: safe(p.username),
      ownerId: safe(p.ownerId),

      url: safe(p.postUrl),

      text: caption,
      caption,
      normalizedText: normalizeText(caption),

      hashtags: cleanHashtags(p.hashtags),

      media: cleanMedia(p.media),
      mediaCount: safeInt(p.mediaCount),

      thumbnail: safe(p.thumbnail),

      isVideo: Boolean(p.isVideo),
      isSidecar: Boolean(p.isSidecar),

      likeCount: safe(p.likeCount),
      commentCount: safeInt(p.commentCount),

      unixDate: safeInt(p.unixDate),
      publishedAt: p.unixDate
        ? new Date(Number(p.unixDate) * 1000).toISOString()
        : null,

      time: safe(p.time),
    });
  }
  return posts;
}

function normaliseYouTubeShorts(shortChannels = []) {
  const posts = [];
  for (const p of shortChannels) {
    if (!p || !p.url) continue;
    const videoId = ytVideoId(p.url);
    posts.push({
      id: videoId,
      platform: "youtube_shorts",
      url: safe(p.url),
      embedUrl: videoId ? `https://www.youtube.com/embed/${videoId}` : null,
      thumbnailUrl: videoId
        ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
        : null,
      caption: safe(p.caption),
      normalizedText: normalizeText(p.caption),
    });
  }
  return posts;
}

function normaliseTwitter(twitterPosts = []) {
  const posts = [];

  for (const t of twitterPosts) {
    if (!t) continue;

    const text = cleanCaption(t.text || "");

    posts.push({
      id: safe(t.tweetId || t.tweet_id),

      platform: "twitter",

      account: safe(t.username || t.screen_name),
      author: safe(t.name),

      url:
        safe(t.url) ||
        (t.username && t.tweetId
          ? `https://x.com/${t.username}/status/${t.tweetId}`
          : null),

      text,
      caption: text,

      normalizedText: normalizeText(text),

      publishedAt: safeDate(t.createdAt || t.created_at),

      likes: safeInt(t.likes || t.favorites),
      replies: safeInt(t.replies),
      retweets: safeInt(t.retweets),
      quotes: safeInt(t.quotes),
      views: safeInt(t.views),
      bookmarks: safeInt(t.bookmarks),

      followers: safeInt(t.followers),
      verified: Boolean(t.verified),

      media: cleanMedia(
        Array.isArray(t.media)
          ? t.media.map((m) => ({
              type: m.type || "image",
              url: m.url,
              thumbnail: m.thumbnail || m.poster || null,
            }))
          : [],
      ),

      hasMedia: Array.isArray(t.media) && t.media.length > 0,

      avatar: safe(t.avatar),
    });
  }

  return posts;
}

function clusterAndFilterPosts(
  posts,
  {
    hardThreshold = 0.82, // near-identical → always collapse
    softThreshold = 0.52, // related story → apply cluster caps
    maxNewsPerCluster = 3,
    maxFunPerCluster = 2,
    platformLimits = {}, // e.g. { youtube_shorts: 1, instagram: 2 }
    defaultPlatformLimit = 1,
    accountLimit = 1, // max posts per account per cluster (key insight!)
    diversityBonus = 0.15, // score boost for bringing a new platform to cluster
  } = {},
) {
  // ─── 1. STOP WORDS ───────────────────────────────────────────────────────────

  const STOP = new Set([
    "the",
    "a",
    "an",
    "and",
    "or",
    "of",
    "for",
    "to",
    "in",
    "on",
    "with",
    "this",
    "that",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "it",
    "its",
    "at",
    "by",
    "from",
    "as",
    "will",
    "would",
    "could",
    "should",
    "can",
    "have",
    "has",
    "had",
    "you",
    "your",
    "their",
    "them",
    "they",
    "our",
    "about",
    "into",
    "over",
    "under",
    "after",
    "before",
    "also",
    "just",
    "more",
    "but",
    "not",
    "so",
    "if",
    "then",
    "do",
    "did",
    "does",
    "up",
    "out",
    "new",
    "get",
    "got",
    "all",
    "one",
    "two",
    "he",
    "she",
    "we",
    "i",
    "am",
    "who",
    "what",
    "when",
    "where",
    "how",
    "which",
    "there",
    "here",
    "very",
    "than",
    "now",
    "still",
    "even",
    "much",
    "many",
    "some",
    "any",
    "only",
    "other",
    "such",
    "like",
    "both",
    "each",
    "few",
    "most",
    "same",
    "own",
    "right",
    "may",
    "might",
    "let",
    "per",
    "via",
    "vs",
    "etc",
    "watch",
    "full",
    "video",
    "check",
    "see",
    "follow",
    "click",
    "link",
    "bio",
    "comment",
    "share",
    "like",
    "repost",
    "retweet",
    "viral",
    "trending",
  ]);

  // ─── 2. TEXT UTILITIES ───────────────────────────────────────────────────────

  function clean(text = "") {
    return String(text)
      .replace(/https?:\/\/\S+/g, " ")
      .replace(/www\.\S+/g, " ")
      .replace(/@\w+/g, " ")
      .replace(/#(\w+)/g, " $1 ")
      .replace(/\[.*?\]/g, " ") // strip bracketed SEO tags common in these posts
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  // Minimal stemmer for common English suffixes
  function stem(w) {
    if (w.length <= 4) return w;
    if (w.endsWith("ing") && w.length > 6) return w.slice(0, -3);
    if (w.endsWith("tion")) return w.slice(0, -4);
    if (w.endsWith("ness")) return w.slice(0, -4);
    if (w.endsWith("ment")) return w.slice(0, -4);
    if ((w.endsWith("er") || w.endsWith("or")) && w.length > 5)
      return w.slice(0, -2);
    if (w.endsWith("ed") && w.length > 4) return w.slice(0, -2);
    if (w.endsWith("ly") && w.length > 4) return w.slice(0, -2);
    if (w.endsWith("es") && w.length > 4) return w.slice(0, -2);
    if (w.endsWith("s") && w.length > 3) return w.slice(0, -1);
    return w;
  }

  function tokenize(text) {
    return clean(text)
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w))
      .map(stem);
  }

  // Build full text from all fields
  function rawText(post) {
    return [
      post.title,
      post.text,
      post.caption,
      post.description,
      post.shortDescription,
      ...(post.hashtags || []),
      ...(post.tags || []),
    ]
      .filter(Boolean)
      .join(" ");
  }

  // Named entities: consecutive Title-Case words (the strongest "same story" signal)
  function namedEntities(text = "") {
    const cleaned = String(text)
      .replace(/https?:\/\/\S+/g, " ")
      .replace(/@\w+/g, " ")
      .replace(/#\w+/g, " ");
    const words = cleaned.split(/\s+/).filter(Boolean);
    const ents = new Set();
    for (let i = 0; i < words.length; i++) {
      if (!/^[A-Z][a-z]/.test(words[i])) continue;
      const w1 = words[i].toLowerCase();
      if (STOP.has(w1)) continue;
      ents.add(w1);
      if (i + 1 < words.length && /^[A-Z][a-z]/.test(words[i + 1])) {
        const w2 = words[i + 1].toLowerCase();
        if (!STOP.has(w2)) {
          ents.add(`${w1} ${w2}`);
          if (i + 2 < words.length && /^[A-Z][a-z]/.test(words[i + 2])) {
            ents.add(`${w1} ${w2} ${words[i + 2].toLowerCase()}`);
          }
        }
      }
    }
    return [...ents];
  }

  // ─── 3. STORY-TYPE FINGERPRINT ───────────────────────────────────────────────
  //
  // We detect the "angle" of a post so two posts about the same named entities
  // but covering different angles (breaking news vs fan reaction vs opinion)
  // are NOT collapsed into one cluster.
  //
  // Types: 'breaking' | 'reaction' | 'opinion' | 'fan' | 'general'

  const BREAKING_SIGNALS = [
    "confirm",
    "offici",
    "announc",
    "start",
    "begin",
    "launch",
    "releas",
    "reveal",
    "break",
    "first",
    "exclus",
    "shoot",
    "film",
    "bts",
    "behind",
  ];
  const REACTION_SIGNALS = [
    "react",
    "respond",
    "reply",
    "say",
    "slam",
    "hit back",
    "fires back",
    "clap",
    "bash",
    "criticiz",
    "prais",
    "support",
    "back",
    "defend",
  ];
  const OPINION_SIGNALS = [
    "think",
    "believ",
    "feel",
    "opinion",
    "view",
    "debate",
    "discuss",
    "controversi",
    "limit",
    "boundari",
    "should",
    "must",
  ];
  const FAN_SIGNALS = [
    "unmatched",
    "aura",
    "king",
    "legend",
    "best",
    "goat",
    "fan",
    "love",
    "miss",
    "adore",
    "worship",
    "stan",
  ];

  function storyType(post) {
    const t = rawText(post).toLowerCase();
    if (BREAKING_SIGNALS.some((s) => t.includes(s))) return "breaking";
    if (REACTION_SIGNALS.some((s) => t.includes(s))) return "reaction";
    if (OPINION_SIGNALS.some((s) => t.includes(s))) return "opinion";
    if (FAN_SIGNALS.some((s) => t.includes(s))) return "fan";
    return "general";
  }

  // ─── 4. IDF OVER CORPUS ──────────────────────────────────────────────────────

  function buildIDF(list) {
    const df = {};
    const N = list.length || 1;
    for (const p of list) {
      for (const w of new Set(tokenize(rawText(p)))) {
        df[w] = (df[w] || 0) + 1;
      }
    }
    const idf = {};
    for (const [w, c] of Object.entries(df)) idf[w] = Math.log(N / c);
    return idf;
  }

  const IDF = buildIDF(posts);

  // ─── 5. SIGNATURE BUILDER ────────────────────────────────────────────────────

  function buildSig(post) {
    const raw = rawText(post);
    const tokens = tokenize(raw);

    // TF-IDF vector
    const tf = {};
    for (const t of tokens) tf[t] = (tf[t] || 0) + 1;
    const tfidf = {};
    for (const [w, freq] of Object.entries(tf)) tfidf[w] = freq * (IDF[w] ?? 1);

    // Bigrams on stemmed tokens
    const bigrams = [];
    for (let i = 0; i < tokens.length - 1; i++)
      bigrams.push(`${tokens[i]}|${tokens[i + 1]}`);

    // Trigrams
    const trigrams = [];
    for (let i = 0; i < tokens.length - 2; i++)
      trigrams.push(`${tokens[i]}|${tokens[i + 1]}|${tokens[i + 2]}`);

    // Named entities (highest signal for creator/celeb content)
    const entities = namedEntities(raw);

    // Hashtags normalised
    const hashtags = (post.hashtags || []).map((h) =>
      h.replace(/^#/, "").toLowerCase(),
    );

    // Top-30 keywords by TF-IDF
    const keywords = Object.entries(tfidf)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([w]) => w);

    // Story type for angle-aware clustering
    const type = storyType(post);

    return {
      tfidf,
      bigrams,
      trigrams,
      entities,
      hashtags,
      keywords,
      tokens,
      type,
    };
  }

  // ─── 6. SIMILARITY ───────────────────────────────────────────────────────────

  function jaccard(a, b) {
    if (!a.length && !b.length) return 0;
    const A = new Set(a),
      B = new Set(b);
    const inter = [...A].filter((x) => B.has(x)).length;
    return inter / new Set([...A, ...B]).size;
  }

  function cosine(vecA, vecB) {
    const words = new Set([...Object.keys(vecA), ...Object.keys(vecB)]);
    let dot = 0,
      mA = 0,
      mB = 0;
    for (const w of words) {
      const a = vecA[w] || 0,
        b = vecB[w] || 0;
      dot += a * b;
      mA += a * a;
      mB += b * b;
    }
    return !mA || !mB ? 0 : dot / (Math.sqrt(mA) * Math.sqrt(mB));
  }

  /**
   * Similarity weights (sum = 1.0):
   *   cosine TF-IDF   0.28  — topic overlap with IDF weighting
   *   named entities  0.32  — same people/shows = same story (highest weight)
   *   keywords        0.16  — discriminative words
   *   bigrams         0.10  — local phrase overlap
   *   trigrams        0.07  — tight phrase match
   *   hashtags        0.07  — explicit tags
   *
   * ANGLE PENALTY: if two posts have different story types AND low entity
   * overlap, we reduce similarity to prevent merging "Sunil Pal slams Samay"
   * with "Samay responds to Sunil Pal" (different angles on same topic).
   */
  function similarity(sigA, sigB) {
    const c = cosine(sigA.tfidf, sigB.tfidf);
    const e = jaccard(sigA.entities, sigB.entities);
    const k = jaccard(sigA.keywords, sigB.keywords);
    const b = jaccard(sigA.bigrams, sigB.bigrams);
    const t = jaccard(sigA.trigrams, sigB.trigrams);
    const h = jaccard(sigA.hashtags, sigB.hashtags);

    let score = c * 0.28 + e * 0.32 + k * 0.16 + b * 0.1 + t * 0.07 + h * 0.07;

    // Angle penalty: different story types + low entity overlap → reduce similarity
    // This keeps "Sunil Pal attacks Samay" and "Samay's reaction to Sunil Pal"
    // as separate stories in the feed
    if (sigA.type !== sigB.type && e < 0.25) {
      score *= 0.75;
    }

    return score;
  }

  // ─── 7. RANKING ──────────────────────────────────────────────────────────────

  function parseNum(v) {
    if (!v) return 0;
    if (typeof v === "number") return v;
    const s = String(v).toLowerCase().trim();
    if (s.includes("m")) return parseFloat(s) * 1_000_000;
    if (s.includes("k")) return parseFloat(s) * 1_000;
    return Number(s) || 0;
  }

  function engagement(post) {
    return (
      parseNum(post.likeCount) * 1.0 +
      parseNum(post.commentCount) * 6.0 +
      parseNum(post.shareCount) * 4.0 +
      parseNum(post.videoViews) * 0.01 +
      parseNum(post.engagement?.reactions) * 1.0 +
      parseNum(post.engagement?.comments) * 6.0 +
      parseNum(post.engagement?.shares) * 4.0
    );
  }

  function sourceScore(post) {
    let score = 0;
    const acct = String(
      post.account || post.channel || post.username || "",
    ).toLowerCase();
    if (post.verified || post.isVerified) score += 3000;
    if (acct.includes("official")) score += 4000;
    if (acct.includes("news")) score += 500;
    if (acct.includes("tv")) score += 400;
    // Boost recognised aggregators that tend to have better context
    const TRUSTED = [
      "viralbhayani",
      "socialketchup",
      "zoomtv",
      "news18",
      "ndtv",
      "indiaexpress",
      "timesofindia",
    ];
    if (TRUSTED.some((t) => acct.includes(t))) score += 800;
    return score;
  }

  function recencyScore(post) {
    return (
      new Date(post.publishedAt || post.scrapedAt || 0).getTime() / 100_000_000
    );
  }

  // trendingScore from news articles
  function trendScore(post) {
    return parseNum(post.trendingScore) * 100;
  }

  function rankPost(post) {
    return (
      engagement(post) +
      sourceScore(post) +
      recencyScore(post) +
      trendScore(post)
    );
  }

  // ─── 8. PLATFORM ─────────────────────────────────────────────────────────────

  function getPlatform(post) {
    return (
      post?.platform ||
      post?.source?.name ||
      post?.medium ||
      "unknown"
    ).toLowerCase();
  }

  function getAccount(post) {
    return (
      post.account ||
      post.channel ||
      post.username ||
      post.source?.name ||
      "unknown"
    ).toLowerCase();
  }

  // ─── 9. SERIES MARKER STRIPPING ──────────────────────────────────────────────

  function stripSeries(text = "") {
    return text
      .replace(/\bpart\s*\d+\b/gi, "")
      .replace(/\bepisode\s*\d+\b/gi, "")
      .replace(/\bep\.?\s*\d+\b/gi, "")
      .replace(/\bvol\.?\s*\d+\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  // ─── 10. SIGNATURE CACHE ─────────────────────────────────────────────────────

  const sigCache = new WeakMap();

  function getSig(post) {
    if (!sigCache.has(post)) {
      const cleaned = {
        ...post,
        title: stripSeries(post.title || ""),
        text: stripSeries(post.text || ""),
        caption: stripSeries(post.caption || ""),
      };
      sigCache.set(post, buildSig(cleaned));
    }
    return sigCache.get(post);
  }

  // ─── 11. CLUSTER POSTS ───────────────────────────────────────────────────────

  const clusters = [];

  for (const post of posts) {
    const sig = getSig(post);
    let bestCluster = null;
    let bestScore = 0;

    for (const cluster of clusters) {
      const score = similarity(sig, getSig(cluster.representative));
      if (score > softThreshold && score > bestScore) {
        bestScore = score;
        bestCluster = cluster;
      }
    }

    if (bestCluster) {
      bestCluster.posts.push(post);
      bestCluster.scores.push(bestScore);
      if (bestScore >= hardThreshold) {
        bestCluster.hardMatches = (bestCluster.hardMatches || 0) + 1;
      }
      // Re-elect representative to highest-ranked post (prevents drift)
      const top = [...bestCluster.posts].sort(
        (a, b) => rankPost(b) - rankPost(a),
      )[0];
      bestCluster.representative = top;
    } else {
      clusters.push({
        representative: post,
        posts: [post],
        scores: [1.0],
        hardMatches: 0,
      });
    }
  }

  // ─── 12. SELECT WINNERS ──────────────────────────────────────────────────────

  const finalNews = [];
  const finalFun = [];
  const hiddenDuplicates = [];

  for (const cluster of clusters) {
    // Sort by rank descending
    cluster.posts.sort((a, b) => rankPost(b) - rankPost(a));

    const category = (cluster.posts[0].category || "lifestyle").toLowerCase();
    const storyLimit =
      category === "news" ? maxNewsPerCluster : maxFunPerCluster;

    // Per-account and per-platform caps within cluster
    const accountCount = {};
    const platformCount = {};
    const seenPlatforms = new Set();
    const visible = [];
    const hidden = [];

    for (const post of cluster.posts) {
      if (visible.length >= storyLimit) {
        hidden.push(post);
        continue;
      }

      const platform = getPlatform(post);
      const account = getAccount(post);
      const pCap = platformLimits[platform] ?? defaultPlatformLimit;
      const pCount = platformCount[platform] || 0;
      const aCap = accountLimit;
      const aCount = accountCount[account] || 0;

      if (pCount >= pCap || aCount >= aCap) {
        hidden.push(post);
        continue;
      }

      // Diversity bonus: if this post brings a new platform to the cluster,
      // it competes better than another post from an already-represented platform
      // (already handled by caps, but track for metadata)
      const isDiversifying = !seenPlatforms.has(platform);
      seenPlatforms.add(platform);

      visible.push(post);
      platformCount[platform] = pCount + 1;
      accountCount[account] = aCount + 1;
      if (isDiversifying) post._diversity = true;
    }

    hiddenDuplicates.push(...hidden);

    if (category === "news") finalNews.push(...visible);
    else finalFun.push(...visible);
  }

  // ─── 13. FINAL SORT ──────────────────────────────────────────────────────────
  const getTimestamp = (p) =>
    p.publishedAt
      ? Date.parse(p.publishedAt)
      : p.scrapedAt
        ? Date.parse(p.scrapedAt)
        : p.unixDate
          ? p.unixDate * 1000
          : 0;

  const byDate = (a, b) => getTimestamp(b) - getTimestamp(a);

  finalNews.sort(byDate);
  finalFun.sort(byDate);

  return {
    news: finalNews,
    lifestyle: finalFun,
    hiddenDuplicates,
    totalInput: posts.length,
    visible: finalNews.length + finalFun.length,
    hidden: hiddenDuplicates.length,
    clusterCount: clusters.length,
    clusters, // full objects for debugging
  };
}

// ─── Main Normaliser ────────────────────────────────────────────────────────

export function normaliseCreator(
  creatorConfig = {},
  rawDocs = [],
  newsDocs = [],
) {
  if (!Array.isArray(rawDocs) || rawDocs.length === 0) {
    return null;
  }

  // Merge all social documents
  const merged = {
    creatorName: creatorConfig?.creatorName,
    socialFollows: {
      instaFollowers: creatorConfig?.instaFCount,
      youtubeSubs: creatorConfig?.youtubeFCount,
    },
    platformState: creatorConfig?.platformState || {},
    createdAt: creatorConfig?.createdAt,
    updatedAt: creatorConfig?.updatedAt,

    instagram: rawDocs.flatMap((d) => d?.instagram || []),

    youtubeShorts: rawDocs.flatMap((d) => d?.youtubeShorts || []),
    twitter: rawDocs.flatMap((d) => d?.twitter || []),
  };

  const dedupeByKey = (arr, key) =>
    Object.values(
      Object.fromEntries(
        arr.map((item, index) => [item?.[key] || `fallback_${index}`, item]),
      ),
    );

  let instagram = normaliseInstagram(dedupeByKey(merged.instagram, "postId"));

  let twitter = normaliseTwitter(dedupeByKey(merged.twitter, "tweetId"));

  let youtubeShorts = normaliseYouTubeShorts(
    dedupeByKey(merged.youtubeShorts, "url"),
  );

  let news = Array.isArray(newsDocs)
    ? newsDocs.flatMap((d) => (Array.isArray(d?.articles) ? d.articles : [d]))
    : [];
  for (const n of news) {
    n.platform = "news";
    n.normalizedText = normalizeText(n.title + n.description + n.content);
  }

  let allPosts = [...instagram, ...youtubeShorts, ...twitter, ...news];

  // assign categories first
  for (const post of allPosts) {
    post.category = getCategory(post);
  }
  // assign topics then
  allPosts = addTopicsToPosts(merged.creatorName, allPosts);
  // console.log(allPosts.filter((f) => !f.topic));
  instagram = allPosts.filter((f) => f.platform == "instagram");

  youtubeShorts = allPosts.filter((f) => f.platform == "youtube_shorts");
  twitter = allPosts.filter((f) => f.platform == "twitter");
  news = allPosts.filter((f) => f.platform == "news");

  // remove duplicates / cluster stories
  const clustered = clusterAndFilterPosts(allPosts);
  console.log("hidden posts:", clustered.hiddenDuplicates.length);
  // keep only visible posts
  const visiblePosts = [...clustered.news, ...clustered.lifestyle];

  const visibleIds = new Set(
    visiblePosts.map((p) => p.id || p.postId || p.url),
  );

  const filteredInstagram = instagram.filter((p) =>
    visibleIds.has(p.id || p.postId || p.url),
  );

  const filteredYoutubeShorts = youtubeShorts.filter((p) =>
    visibleIds.has(p.id || p.postId || p.url),
  );

  const filteredTwitter = twitter.filter((p) =>
    visibleIds.has(p.id || p.postId || p.url),
  );

  const filteredNews = news.filter((p) =>
    visibleIds.has(p.id || p.postId || p.url),
  );

  const seenUrls = new Set();

  const dedupeByUrl = (posts) =>
    posts.filter((p) => {
      if (!p.url) return true;

      if (seenUrls.has(p.url)) return false;

      seenUrls.add(p.url);
      return true;
    });

  const categorized = {
    news: dedupeByUrl(clustered.news),
    lifestyle: dedupeByUrl(clustered.lifestyle),
  };

  const stats = {
    instagram: {
      totalDocuments: rawDocs.filter(
        (d) => Array.isArray(d.instagram) && d.instagram.length > 0,
      ).length,

      totalPosts: instagram.length,
    },

    youtubeShorts: {
      totalDocuments: rawDocs.filter(
        (d) => Array.isArray(d.youtubeShorts) && d.youtubeShorts.length > 0,
      ).length,

      totalShorts: youtubeShorts.length,
    },

    twitter: {
      totalDocuments: rawDocs.filter(
        (d) => Array.isArray(d.twitter) && d.twitter.length > 0,
      ).length,

      totalPosts: twitter.length,

      totalViews: twitter.reduce((s, p) => s + (p.views || 0), 0),

      totalLikes: twitter.reduce((s, p) => s + (p.likes || 0), 0),
    },

    news: {
      totalArticles: news.length,
    },
  };

  return {
    creatorName: safe(merged.creatorName),
    socialFollows: merged.socialFollows,
    createdAt: safeDate(merged.createdAt),
    updatedAt: safeDate(merged.updatedAt),

    stats,

    sections: {
      instagram: filteredInstagram,
      youtubeShorts: filteredYoutubeShorts,
      twitter: filteredTwitter,
      news: filteredNews,
    },

    categorized,

    dumpInfo: {
      totalDumpDocuments: rawDocs.length,

      latestDumpDate: rawDocs[0]?.scrapeDate,

      oldestDumpDate: rawDocs[rawDocs.length - 1]?.scrapeDate,

      platformCoverage: {
        instagram: rawDocs.filter((d) => d.instagram?.length).length,

        twitter: rawDocs.filter((d) => d.twitter?.length).length,

        youtubeShorts: rawDocs.filter((d) => d.youtubeShorts?.length).length,
      },
    },
  };
}
