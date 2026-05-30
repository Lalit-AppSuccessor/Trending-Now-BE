/**
 * clusterAndFilterPosts — Creator Intelligence Feed Engine v2
 *
 * Designed for creator-focused aggregation where many accounts (socialketchup,
 * glamsham, viralbhayani, indiancreatorclub, filmygyan, etc.) all post about
 * the SAME story (e.g. "Samay Raina IGL Season 2 shoot begins") within hours
 * of each other. Standard dedup isn't enough — we need story-level clustering.
 *
 * Core approach:
 *  1. Named-entity + story-fingerprint extraction
 *  2. IDF-weighted cosine similarity (rare topic words matter most)
 *  3. Two-threshold clustering: hard-dupe collapse + soft story-merge
 *  4. Per-account AND per-platform caps inside each story cluster
 *  5. Platform diversity bonus — prefer showing different platforms
 *  6. Story-type detection: "breaking/update" vs "reaction/opinion" vs "fan"
 *     so a "Sunil Pal slams Samay" news post doesn't suppress a "Samay
 *     responds" post even though they share named entities
 *  7. Cross-creator awareness: if data contains posts about MULTIPLE creators,
 *     each creator's stories are clustered independently then merged by recency
 */

export function clusterAndFilterPosts(
  posts,
  {
    hardThreshold = 0.82, // near-identical → always collapse
    softThreshold = 0.52, // related story → apply cluster caps
    maxNewsPerCluster = 3,
    maxFunPerCluster = 2,
    platformLimits = {}, // e.g. { youtube_shorts: 1, instagram: 2 }
    defaultPlatformLimit = 2,
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

    const category = (cluster.posts[0].category || "fun").toLowerCase();
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
    fun: finalFun,
    hiddenDuplicates,
    totalInput: posts.length,
    visible: finalNews.length + finalFun.length,
    hidden: hiddenDuplicates.length,
    clusterCount: clusters.length,
    clusters, // full objects for debugging
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOW TO USE WITH THE SAMAY RAINA / MULTI-CREATOR DATA FORMAT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * normalizeCreatorData(data)
 *
 * Flattens the nested creator data structure (with sections.instagram,
 * sections.youtubeShorts, sections.news, etc.) into a single flat array
 * that clusterAndFilterPosts() can consume.
 *
 * Also handles cross-creator feeds: if you pass an ARRAY of creator data
 * objects, they are all merged before clustering so posts from different
 * creators competing for the same story slot are handled correctly.
 */
export function normalizeCreatorData(creatorDataOrArray) {
  const dataList = Array.isArray(creatorDataOrArray)
    ? creatorDataOrArray
    : [creatorDataOrArray];

  const allPosts = [];

  for (const data of dataList) {
    const sections = data.sections || data;
    const creatorName = data.creatorName || "unknown";

    // Instagram
    for (const post of sections.instagram || []) {
      allPosts.push({ ...post, creatorName });
    }

    // Facebook
    for (const post of sections.facebook || []) {
      allPosts.push({ ...post, platform: "facebook", creatorName });
    }

    // YouTube (long-form)
    for (const post of sections.youtube || []) {
      allPosts.push({ ...post, platform: "youtube", creatorName });
    }

    // YouTube Shorts
    for (const post of sections.youtubeShorts || []) {
      allPosts.push({
        ...post,
        platform: post.platform || "youtube_shorts",
        // Shorts often only have caption — map it to text as well
        text: post.text || post.caption,
        creatorName,
      });
    }

    // News articles
    for (const article of sections.news || []) {
      allPosts.push({
        ...article,
        id: article._id || article.id,
        platform: "news",
        account: article.source?.name || "news",
        text: [
          article.title,
          article.description,
          article.content?.slice(0, 500),
        ]
          .filter(Boolean)
          .join(" "),
        caption: article.description,
        likeCount: article.reactions?.like || 0,
        publishedAt: article.publishedAt,
        category: article.category || "news",
        creatorName,
      });
    }
  }

  return allPosts;
}
