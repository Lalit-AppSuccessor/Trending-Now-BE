/**
 * normalizer.js
 * Transforms raw scraped MongoDB documents into a clean, frontend-ready shape.
 * Handles missing/null fields gracefully since scraped data is often sparse.
 */

import { clusterAndFilterPosts } from "./clusterFilteringEngine.js";
import { getCategory } from "./filterContentCategories.js";

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
    .filter((m) => m && m.url && m.url.trim())
    .filter((m) => {
      if (seen.has(m.url)) return false;
      seen.add(m.url);
      return true;
    })
    .map((m) => ({
      type: safe(m.type, "image"),
      url: m.url.trim(),

      thumbnail: m.thumbnail || null,
      poster: m.poster || null,
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

function normaliseFacebook(fbAccounts = []) {
  const posts = [];
  for (const account of fbAccounts) {
    if (!account || !Array.isArray(account.data)) continue;
    for (const p of account.data) {
      if (!p) continue;
      posts.push({
        id: safe(p.post_id),
        platform: "facebook",
        account: safe(account.fbhandle),
        url: safe(p.url),
        text: safe(p.message),
        publishedAt: safeTimestamp(p.timestamp),
        media: cleanMedia(
          p.video_thumbnail
            ? [
                { type: "image", url: p.video_thumbnail },
                ...(p.image ? [{ type: "image", url: p.image }] : []),
              ]
            : p.image
              ? [{ type: "image", url: p.image }]
              : [],
        ),
        videoUrl: safe(p.video),
        videoViews: safeInt(p.video_view_count),
        engagement: {
          comments: safeInt(p.comments_count),
          reactions: safeInt(p.reactions_count),
          shares: safeInt(p.reshare_count),
          breakdown: p.reactions
            ? {
                like: safeInt(p.reactions.like),
                love: safeInt(p.reactions.love),
                haha: safeInt(p.reactions.haha),
                care: safeInt(p.reactions.care),
                wow: safeInt(p.reactions.wow),
                sad: safeInt(p.reactions.sad),
                angry: safeInt(p.reactions.angry),
              }
            : null,
        },
        scrapedAt: safeDate(account.scrapedAt),
      });
    }
  }
  return posts;
}

function normaliseInstagram(igAccounts = []) {
  const posts = [];

  for (const account of igAccounts) {
    if (!account || !Array.isArray(account.data) || account.data.length === 0)
      continue;

    for (const p of account.data) {
      if (!p) continue;

      const caption = cleanCaption(p.caption);

      posts.push({
        id: safe(p.shortcode || p.postId),
        postId: safe(p.postId),

        platform: "instagram",

        account: safe(p.username || account.username),
        ownerId: safe(p.ownerId),

        url: safe(p.postUrl),

        text: caption,
        caption,

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

        scrapedAt: safeDate(account.scrapedAt),
      });
    }
  }

  return posts;
}

function normaliseYouTube(ytChannels = []) {
  const posts = [];
  for (const channel of ytChannels) {
    if (!channel || !Array.isArray(channel.data)) continue;
    for (const p of channel.data) {
      if (!p) continue;
      // Filter out profile/avatar images — only keep thumbnail-like images (hq720, etc.)
      const filteredMedia = cleanMedia(
        (p.media || []).filter((m) => m && m.url && !m.url.includes("=s48-")),
      );
      posts.push({
        id: null,
        platform: "youtube",
        account: safe(channel.channel),
        text: safe(p.text),
        published: safe(p.published), // relative string like "3 months ago"
        likes: safe(p.likes),
        media: filteredMedia,
        scrapedAt: safeDate(channel.scrapedAt),
      });
    }
  }
  return posts;
}

function normaliseYouTubeShorts(shortChannels = []) {
  const posts = [];
  for (const channel of shortChannels) {
    if (!channel || !Array.isArray(channel.data)) continue;
    for (const p of channel.data) {
      if (!p || !p.url) continue;
      const videoId = ytVideoId(p.url);
      posts.push({
        id: videoId,
        platform: "youtube_shorts",
        account: safe(channel.channel),
        url: safe(p.url),
        embedUrl: videoId ? `https://www.youtube.com/embed/${videoId}` : null,
        thumbnailUrl: videoId
          ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
          : null,
        caption: safe(p.caption),
        scrapedAt: safeDate(channel.scrapedAt),
      });
    }
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
// ─── Main Normaliser ────────────────────────────────────────────────────────

export function normaliseCreator(rawDocs = [], newsDocs = []) {
  if (!Array.isArray(rawDocs) || rawDocs.length === 0) {
    return null;
  }

  // Merge all social documents
  const merged = {
    creatorName: rawDocs[0]?.creatorName,
    createdAt: rawDocs[0]?.createdAt,
    updatedAt: rawDocs[0]?.updatedAt,

    facebook: rawDocs.flatMap((d) => d?.facebook || []),
    instagram: rawDocs.flatMap((d) => d?.instagram || []),
    youtube: rawDocs.flatMap((d) => d?.youtube || []),
    youtubeShorts: rawDocs.flatMap((d) => d?.youtubeShorts || []),
    twitter: rawDocs.flatMap((d) => d?.twitter || []),
  };

  const facebook = normaliseFacebook(merged.facebook);
  const instagram = normaliseInstagram(merged.instagram);
  const youtube = normaliseYouTube(merged.youtube);
  const youtubeShorts = normaliseYouTubeShorts(merged.youtubeShorts);
  const twitter = normaliseTwitter(merged.twitter);

  const news = Array.isArray(newsDocs)
    ? newsDocs.flatMap((d) => (Array.isArray(d?.articles) ? d.articles : [d]))
    : [];

  const allPosts = [
    ...facebook,
    ...instagram,
    ...youtube,
    ...youtubeShorts,
    ...twitter,
    ...news,
  ];

  // assign categories first
  for (const post of allPosts) {
    post.category = getCategory(post);
  }

  // remove duplicates / cluster stories
  const clustered = clusterAndFilterPosts(allPosts);
  console.log("hidden posts:", clustered.hiddenDuplicates.length);
  // keep only visible posts
  const visiblePosts = [...clustered.news, ...clustered.fun];

  const visibleIds = new Set(
    visiblePosts.map((p) => p.id || p.postId || p.url),
  );

  // filter sections
  const filteredFacebook = facebook.filter((p) =>
    visibleIds.has(p.id || p.postId || p.url),
  );

  const filteredInstagram = instagram.filter((p) =>
    visibleIds.has(p.id || p.postId || p.url),
  );

  const filteredYoutube = youtube.filter((p) =>
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
    fun: dedupeByUrl(clustered.fun),
  };

  const stats = {
    facebook: {
      accounts: merged.facebook.filter((a) => a && a.data?.length > 0).length,
      totalPosts: facebook.length,
      totalReactions: facebook.reduce(
        (s, p) => s + (p.engagement?.reactions || 0),
        0,
      ),
      totalViews: facebook.reduce((s, p) => s + (p.videoViews || 0), 0),
    },

    instagram: {
      accounts: merged.instagram.filter((a) => a && a.data?.length > 0).length,
      totalPosts: instagram.length,
    },

    youtube: {
      channels: merged.youtube.filter((c) => c && c.data?.length > 0).length,
      totalPosts: youtube.length,
    },

    youtubeShorts: {
      channels: merged.youtubeShorts.filter((c) => c && c.data?.length > 0)
        .length,
      totalShorts: youtubeShorts.length,
    },

    twitter: {
      accounts: merged.twitter.filter((a) => a && a.data?.length > 0).length,

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
    createdAt: safeDate(merged.createdAt),
    updatedAt: safeDate(merged.updatedAt),

    stats,

    sections: {
      facebook: filteredFacebook,
      instagram: filteredInstagram,
      youtube: filteredYoutube,
      youtubeShorts: filteredYoutubeShorts,
      twitter: filteredTwitter,
      news: filteredNews,
    },

    categorized,
  };
}
