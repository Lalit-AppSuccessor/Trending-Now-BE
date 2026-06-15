import { CREATOR_NAMES } from "../constants/keywords.js";
import SocialDumpStore from "../models/SocialDumpStore.js";
import SocialAllDump from "../models/SocialAllDump.js";

export const parseRelativeDate = (text) => {
  if (!text) return null;

  const value = text.toLowerCase().trim();

  const now = new Date();

  // JUST NOW
  if (value.includes("just now") || value.includes("few seconds")) {
    return now;
  }

  const match = value.match(
    /(\d+|a)\s+(second|minute|hour|day|week|month|year)/,
  );

  if (!match) return null;

  let amount = match[1] === "a" ? 1 : parseInt(match[1]);

  const unit = match[2];

  const date = new Date(now);

  switch (unit) {
    case "second":
      date.setSeconds(date.getSeconds() - amount);
      break;

    case "minute":
      date.setMinutes(date.getMinutes() - amount);
      break;

    case "hour":
      date.setHours(date.getHours() - amount);
      break;

    case "day":
      date.setDate(date.getDate() - amount);
      break;

    case "week":
      date.setDate(date.getDate() - amount * 7);
      break;

    case "month":
      date.setMonth(date.getMonth() - amount);
      break;

    case "year":
      date.setFullYear(date.getFullYear() - amount);
      break;
  }

  return date;
};

export const CREATOR_LOOKUP = CREATOR_NAMES.map((creator) => ({
  ...creator,
  allKeywords: [
    creator.name.replace(/_/g, " ").toLowerCase(),
    ...(creator.keywords || []).map((k) => k.toLowerCase()),
  ],
}));

export function createCreatorCache() {
  const cache = {};

  for (const creator of CREATOR_NAMES) {
    cache[creator.name] = {
      creator: creator.name,
      channelName: creator.channelName,
      totalPosts: 0,
      data: [],
      seenPosts: new Set(),
    };
  }

  return cache;
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const keywords = [
  ...new Set(CREATOR_NAMES.flatMap((creator) => creator.twitterKeyword || [])),
].map((k) => encodeURIComponent(k));

export function getMatchedCreators(text = "") {
  const searchableText = text
    .toLowerCase()
    .replace(/[#_]/g, "")
    .replace(/\s+/g, "");

  return CREATOR_LOOKUP.filter((creator) =>
    creator.allKeywords.some((keyword) =>
      searchableText.includes(
        keyword.toLowerCase().replace(/[#_]/g, "").replace(/\s+/g, ""),
      ),
    ),
  ).map((creator) => creator.name);
}

export function extractMedia(tweet) {
  const media = [];

  if (!tweet.media) return media;

  if (tweet.media.photo) {
    tweet.media.photo.forEach((p) => {
      media.push({
        type: "photo",
        url: p.media_url_https,
      });
    });
  }

  if (tweet.media.video) {
    tweet.media.video.forEach((v) => {
      const bestMp4 = v.variants
        ?.filter((x) => x.content_type === "video/mp4")
        ?.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];

      media.push({
        type: "video",
        thumbnail: v.media_url_https,
        url: bestMp4?.url || "",
      });
    });
  }

  return media;
}

export async function getPlatformScrapeConfig(platform) {
  let dumpStore = await SocialDumpStore.findOne({
    creatorName: "__system__",
  });

  if (!dumpStore) {
    return {
      isBootstrap: true,
      dumpStore: null,
      rangeDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
    };
  }

  const state = dumpStore.platformState?.[platform];

  if (!state?.bootstrapCompleted) {
    return {
      isBootstrap: true,
      dumpStore,
      rangeDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
    };
  }

  const rangeDate = new Date();

  rangeDate.setDate(rangeDate.getDate() - 1);

  return {
    isBootstrap: false,
    dumpStore,
    rangeDate,
  };
}

function groupPostsByDay(posts) {
  const grouped = {};

  for (const post of posts || []) {
    const date = post.time || post.createdAt || post.publishDate;

    if (!date) continue;

    const day = new Date(date).toISOString().split("T")[0];

    if (!grouped[day]) {
      grouped[day] = [];
    }

    grouped[day].push(post);
  }

  return grouped;
}

export async function savePlatformData({ creatorName, platform, posts }) {
  let dumpStore = await SocialDumpStore.findOne({
    creatorName,
  });

  if (!dumpStore) {
    dumpStore = await SocialDumpStore.create({
      creatorName,
      instaFCount: 0,
      youtubeFCount: null,
    });
  }

  if (!posts?.length) {
    await SocialDumpStore.findOneAndUpdate(
      {
        creatorName: "__system__",
      },
      {
        $set: {
          creatorName: "__system__",

          [`platformState.${platform}.bootstrapCompleted`]: true,

          [`platformState.${platform}.lastScrapedAt`]: new Date(),

          [`platformState.${platform}.latestPostDate`]: null,
        },
      },
      {
        upsert: true,
      },
    );

    return;
  }

  const groupedPosts = groupPostsByDay(posts);

  for (const [day, dayPosts] of Object.entries(groupedPosts)) {
    const scrapeDate = new Date(day);

    const expireAt = new Date(scrapeDate);

    expireAt.setMonth(expireAt.getMonth() + 3);

    const existing = await SocialAllDump.findOne({
      creatorName,
      scrapeDate,
    });

    if (!existing) {
      await SocialAllDump.create({
        creatorName,

        dumpStoreId: dumpStore._id,

        scrapeDate,

        [platform]: dayPosts,

        expireAt,
      });
    } else {
      await SocialAllDump.updateOne(
        {
          _id: existing._id,
        },
        {
          $addToSet: {
            [platform]: {
              $each: dayPosts,
            },
          },
        },
      );
    }
  }

  const latestPostDate =
    posts?.length > 0
      ? new Date(
          Math.max(
            ...posts.map((x) =>
              new Date(x.time || x.createdAt || x.publishDate).getTime(),
            ),
          ),
        )
      : null;

  await SocialDumpStore.findOneAndUpdate(
    {
      creatorName: "__system__",
    },
    {
      $set: {
        creatorName: "__system__",

        [`platformState.${platform}.bootstrapCompleted`]: true,

        [`platformState.${platform}.lastScrapedAt`]: new Date(),

        [`platformState.${platform}.latestPostDate`]: latestPostDate,
      },
    },
    {
      upsert: true,
    },
  );
}
