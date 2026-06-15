import * as cheerio from "cheerio";
import { chromium } from "playwright";
import dotenv from "dotenv";
import { containsUsername } from "../utils/creatorNameRegex.js";
import {
  CREATOR_NAMES,
  INSTA_ACCOUNTS,
  YT_CHANNELS,
} from "../constants/keywords.js";
import {
  createCreatorCache,
  CREATOR_LOOKUP,
  extractMedia,
  getMatchedCreators,
  getPlatformScrapeConfig,
  keywords,
  savePlatformData,
  sleep,
} from "../utils/scraperHelpers.js";
import { syncInstagramMedia } from "../utils/mediaCDNWorker.js";
import SocialDumpStore from "../models/SocialDumpStore.js";

dotenv.config();

//  creator instagram posts caching
let creatorCache = createCreatorCache();

function resetCreatorCache() {
  creatorCache = createCreatorCache();
}

// dynamic api key swapping
const RAPIDAPI_KEYS = [
  process.env.RAPID_API_KEY1,
  process.env.RAPID_API_KEY2,
  process.env.RAPID_API_KEY3,
  process.env.RAPID_API_KEY4,
].filter(Boolean);

async function rapidApiFetch(url, options = {}) {
  let lastError;

  for (const [index, apiKey] of RAPIDAPI_KEYS.entries()) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          "x-rapidapi-key": apiKey,
        },
      });

      if (response.status === 429) {
        console.log(`Key ${index + 1} rate limited`);
        continue;
      }

      if (response.status >= 500) {
        console.log(`Provider error ${response.status}`);
        continue;
      }

      if (response.status === 403) {
        const clone = response.clone();
        const text = await clone.text();

        if (
          text.toLowerCase().includes("quota") ||
          text.toLowerCase().includes("limit") ||
          text.toLowerCase().includes("exceeded")
        ) {
          console.log(`Key ${index + 1} quota exceeded`);
          continue;
        }
      }

      return response;
    } catch (err) {
      lastError = err;
      console.log(`Key ${index + 1} failed: ${err.message}`);

      await sleep(1000);
    }
  }

  throw lastError || new Error("All RapidAPI keys exhausted");
}

// ─── INSTAGRAM: profile posts ────────────────────────────────────────────────

export function processItems({
  edges = [],
  scannedIds,
  matchedPosts,
  creatorLookup,
  rangeDate,
  username,
}) {
  let scannedCount = 0;
  let reachedDateLimit = false;

  for (const edge of edges) {
    const item = edge?.node;

    if (!item?.id) continue;

    if (scannedIds.has(item.id)) continue;

    scannedIds.add(item.id);

    scannedCount++;

    const postDate = new Date(item.taken_at * 1000);

    if (postDate < rangeDate) {
      reachedDateLimit = true;
      break;
    }

    const caption = item?.caption?.text || "";

    const hashtags = caption.match(/#\w+/g) || [];

    const searchableText = `${caption} ${hashtags.join(" ")}`
      .toLowerCase()
      .replace(/[#_]/g, "")
      .replace(/\s+/g, "");

    const matchedCreators = creatorLookup
      .filter((creator) =>
        creator.allKeywords.some((keyword) =>
          searchableText.includes(
            keyword.toLowerCase().replace(/[#_]/g, "").replace(/\s+/g, ""),
          ),
        ),
      )
      .map((creator) => creator.name);

    if (!matchedCreators.length) {
      continue;
    }

    const media = [];

    // Reel
    if (item.video_versions?.length) {
      media.push({
        type: "video",
        url: item.video_versions[0].url,
        poster: item.image_versions2?.candidates?.[0]?.url || null,
        firebaseUrl: null,
        firebasePoster: null,
        uploadedAt: null,
      });
    }

    // Carousel
    else if (item.carousel_media?.length) {
      for (const mediaItem of item.carousel_media) {
        const videoUrl = mediaItem.video_versions?.[0]?.url;

        const imageUrl = mediaItem.image_versions2?.candidates?.[0]?.url;

        media.push({
          type: videoUrl ? "video" : "image",
          url: videoUrl || imageUrl,
          poster: imageUrl || null,
          firebaseUrl: null,
          firebasePoster: null,
          uploadedAt: null,
        });
      }
    }

    // Single Image
    else {
      const imageUrl = item.image_versions2?.candidates?.[0]?.url;

      if (imageUrl) {
        media.push({
          type: "image",
          url: imageUrl,
          firebaseUrl: null,
          uploadedAt: null,
        });
      }
    }

    const post = {
      creators: matchedCreators,

      shortcode: item.code,

      postId: item.id,

      postUrl: `https://www.instagram.com/p/${item.code}/`,

      username,

      ownerId: item.owner?.id || null,

      caption,

      hashtags,

      time: postDate.toISOString(),

      unixDate: item.taken_at,

      likeCount: item.like_count || 0,

      commentCount: item.comment_count || 0,

      isVideo: item.video_versions?.length > 0,

      isSidecar: item.carousel_media?.length > 0,

      thumbnail: item.image_versions2?.candidates?.[0]?.url || null,

      mediaCount: media.length,

      media,
    };

    matchedPosts.push(post);

    for (const creatorName of matchedCreators) {
      const bucket = creatorCache[creatorName];

      if (!bucket) continue;

      if (bucket.seenPosts.has(post.postId)) {
        continue;
      }

      bucket.seenPosts.add(post.postId);

      bucket.data.push(post);

      bucket.totalPosts++;
    }
  }

  return {
    scannedCount,
    reachedDateLimit,
  };
}

export async function fetchInstagramPosts(username, maxId = null) {
  const body = { username };

  if (maxId) {
    body.maxId = maxId;
  }
  const url = "https://instagram120.p.rapidapi.com/api/instagram/posts";

  const response = await rapidApiFetch(url, {
    method: "POST",
    headers: {
      "x-rapidapi-host": "instagram120.p.rapidapi.com",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`RapidAPI Error ${response.status}`);
  }

  return response.json();
}

export async function scrapeInstagramAccount({
  username,
  creatorLookup,
  rangeDate,
}) {
  const scannedIds = new Set();

  const matchedPosts = [];

  const MAX_PAGES_PER_ACCOUNT = 15;

  let totalScanned = 0;

  let maxId = null;

  let hasNextPage = true;

  let reachedDateLimit = false;

  let pageNumber = 1;

  let stopReason = null;

  while (
    hasNextPage &&
    !reachedDateLimit &&
    pageNumber <= MAX_PAGES_PER_ACCOUNT
  ) {
    console.log(`[${username}] Fetch Page ${pageNumber}`);

    let json;

    try {
      json = await fetchInstagramPosts(username, maxId);
    } catch (e) {
      console.log(`[${username}] fetch failed`, e.message);
      break;
    }

    const edges = json?.result?.edges || [];

    if (!edges.length) {
      break;
    }

    const processed = processItems({
      edges,
      scannedIds,
      matchedPosts,
      creatorLookup,
      rangeDate,
      username,
    });

    totalScanned += processed.scannedCount;

    reachedDateLimit = processed.reachedDateLimit;

    const pageInfo = json?.result?.page_info || {};

    hasNextPage = pageInfo.has_next_page === true;

    maxId = pageInfo.end_cursor || null;

    console.log({
      username,
      pageNumber,
      pagePosts: edges.length,
      totalScanned,
      matchedPosts: matchedPosts.length,
      hasNextPage,
      maxId,
      reachedDateLimit,
    });

    pageNumber++;

    if (!hasNextPage || !maxId) {
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  if (reachedDateLimit) {
    stopReason = "date_limit";
  } else if (pageNumber > MAX_PAGES_PER_ACCOUNT) {
    stopReason = "page_limit";
  } else if (!hasNextPage) {
    stopReason = "no_more_pages";
  }

  return {
    username,
    scrapedAt: new Date(),
    scannedPosts: totalScanned,
    totalPosts: matchedPosts.length,
    stopReason,
    data: matchedPosts,
  };
}

export const InstagramPosts = async () => {
  try {
    // Reset cache for every fresh scrape
    resetCreatorCache();

    const accounts = INSTA_ACCOUNTS;

    if (!Array.isArray(accounts) || !accounts.length) {
      return {
        success: false,
        error: "accounts array required",
      };
    }

    // ----------------------------------------------------
    // LAST 3 MONTHS
    // ----------------------------------------------------

    const allInstagramData = [];

    // ----------------------------------------------------
    // PARALLEL ACCOUNT BATCHES
    // ----------------------------------------------------

    const BATCH_SIZE = 2;

    const instagramConfig = await getPlatformScrapeConfig("instagram");

    for (let i = 0; i < accounts.length; i += BATCH_SIZE) {
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;

      const batch = accounts.slice(i, i + BATCH_SIZE);

      console.log(
        `Starting batch ${batchNumber} / ${Math.ceil(accounts.length / BATCH_SIZE)}`,
      );

      await new Promise((resolve) => setTimeout(resolve, 3000));

      const batchResults = await Promise.allSettled(
        batch.map(async (account) => {
          return scrapeInstagramAccount({
            username: account.username,
            creatorLookup: CREATOR_LOOKUP,
            rangeDate: instagramConfig.rangeDate,
          });
        }),
      );

      for (let j = 0; j < batchResults.length; j++) {
        const result = batchResults[j];

        const account = batch[j];

        if (result.status === "fulfilled") {
          allInstagramData.push(result.value);
        } else {
          allInstagramData.push({
            username: account.username,
            error: result.reason?.message || "Unknown error",
          });
        }
      }

      console.log(`Completed batch ${batchNumber}`);

      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    const creatorResults = Object.values(creatorCache).map((creator) => ({
      ...creator,
      seenPosts: undefined,
    }));

    for (const creator of creatorResults) {
      await savePlatformData({
        creatorName: creator.creator,
        platform: "instagram",
        posts: creator.data,
      });
    }

    const res = {
      success: true,
      totalAccounts: allInstagramData.length,
      totalCreators: CREATOR_NAMES.length,
      data: creatorResults,
    };

    setImmediate(() => {
      syncInstagramMedia().catch(console.error);
    });

    return res;
  } catch (e) {
    console.log(e);

    return {
      success: false,
      partial: true,
      error: e.message,

      totalCreators: CREATOR_NAMES.length,

      data: Object.values(creatorCache).map((creator) => ({
        ...creator,
        seenPosts: undefined,
      })),
    };
  }
};

// ─── Twitter: posts ────────────────────────────────────────────────

export const TwitterPosts = async () => {
  try {
    const uniqueIds = new Set();
    const posts = [];

    const twitterConfig = await getPlatformScrapeConfig("twitter");

    const rangeDate = twitterConfig.rangeDate;

    for (const keyword of keywords) {
      try {
        console.log(`Searching: ${keyword}`);

        const url = `https://twitter-api45.p.rapidapi.com/search.php?query=${encodeURIComponent(keyword)}&search_type=Top`;

        const response = await rapidApiFetch(url, {
          method: "GET",
          headers: {
            "x-rapidapi-host": "twitter-api45.p.rapidapi.com",
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          const errorText = await response.text();

          console.error(
            `Search error for "${keyword}"`,
            response.status,
            errorText,
          );

          if (response.status === 429) {
            console.log("Rate limited. Waiting 30 seconds...");
            await sleep(30000);
          } else {
            await sleep(3000);
          }

          continue;
        }

        const data = await response.json();

        const tweets = (data.timeline || []).filter(
          (item) => item.type === "tweet",
        );

        console.log(`"${keyword}" => ${tweets.length} tweets`);

        for (const tweet of tweets) {
          const tweetId = tweet.tweet_id;

          if (!tweetId) continue;

          if (uniqueIds.has(tweetId)) continue;

          uniqueIds.add(tweetId);

          if (new Date(tweet.created_at) < rangeDate) {
            continue;
          }

          const matchedCreators = getMatchedCreators(tweet.text || "");

          if (!matchedCreators.length) {
            continue;
          }

          const media = extractMedia(tweet);

          if (!media || media.length === 0) {
            continue;
          }

          posts.push({
            creators: matchedCreators,

            tweetId,

            matchedKeyword: keyword,

            username: tweet.screen_name || tweet.user_info?.screen_name || "",

            name: tweet.user_info?.name || "",

            text: tweet.text || "",

            createdAt: tweet.created_at,

            likes: tweet.favorites || 0,

            quotes: tweet.quotes || 0,

            views: Number(tweet.views || 0),

            bookmarks: tweet.bookmarks || 0,

            lang: tweet.lang || "",

            media,

            mediaCount: media.length,

            avatar: tweet.user_info?.avatar || "",

            followers: tweet.user_info?.followers_count || 0,

            verified: tweet.user_info?.verified || false,

            location: tweet.user_info?.location || "",

            url: `https://x.com/${tweet.screen_name}/status/${tweetId}`,
          });
        }

        await sleep(2000);
      } catch (err) {
        console.error(`Keyword failed: ${keyword}`, err.message);

        await sleep(5000);
      }
    }

    posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const creatorResults = {};

    for (const creator of CREATOR_NAMES) {
      creatorResults[creator.name] = {
        creator: creator.name,
        channelName: creator.channelName,
        totalPosts: 0,
        data: [],
      };
    }

    for (const post of posts) {
      for (const creatorName of post.creators || []) {
        if (!creatorResults[creatorName]) continue;

        creatorResults[creatorName].data.push(post);
        creatorResults[creatorName].totalPosts++;
      }
    }

    const creatorArray = Object.values(creatorResults);

    for (const creator of creatorArray) {
      await savePlatformData({
        creatorName: creator.creator,
        platform: "twitter",
        posts: creator.data,
      });
    }

    return {
      success: true,
      keywordsProcessed: keywords.length,
      totalMatches: posts.length,
      totalCreators: CREATOR_NAMES.length,
      data: creatorArray,
    };
  } catch (error) {
    console.error(error);

    return {
      success: false,
      error: error.message,
    };
  }
};

// ─── YOUTUBE: channel shorts ────────────────────────────────────────

export const YoutubeShorts = async () => {
  // const { channels } = req.body;

  const channels = YT_CHANNELS;

  resetCreatorCache();

  if (!Array.isArray(channels) || channels.length === 0) {
    return {
      success: false,
      error: "channels array required",
    };
  }

  let browser;

  try {
    browser = await chromium.launch({
      headless: true,
    });

    const toDate = new Date();

    const config = await getPlatformScrapeConfig("youtubeShorts");

    const fromDate = config.rangeDate;

    console.log(
      `Filtering Shorts from ${fromDate.toISOString()} to ${toDate.toISOString()}`,
    );

    for (const channel of channels) {
      try {
        let shortsUrl = channel;

        if (channel.startsWith("@")) {
          shortsUrl = `https://www.youtube.com/${channel}/shorts`;
        } else if (!channel.startsWith("http")) {
          shortsUrl = `https://www.youtube.com/@${channel}/shorts`;
        }

        if (!shortsUrl.includes("/shorts")) {
          shortsUrl = shortsUrl.replace(/\/$/, "") + "/shorts";
        }

        console.log("Scraping:", shortsUrl);

        const page = await browser.newPage();

        await page.goto(shortsUrl, {
          waitUntil: "networkidle",
          timeout: 120000,
        });

        await page.setViewportSize({
          width: 1920,
          height: 4000,
        });

        await page.evaluate(() => {
          document.body.style.zoom = "30%";
        });

        await page.waitForTimeout(3000);

        const processedUrls = new Set();
        const matchingShorts = [];

        let stopScrolling = false;
        let noNewContentCount = 0;

        let scrollCount = 0;
        const MAX_SCROLLS = 100;

        let noKeywordMatchScrolls = 0;
        const MAX_NO_MATCH_SCROLLS = 30;

        while (!stopScrolling && scrollCount < MAX_SCROLLS) {
          scrollCount++;

          console.log(`${channel}: Scroll ${scrollCount}/${MAX_SCROLLS}`);
          const discoveredShorts = await page
            .locator("a")
            .evaluateAll((els) => {
              const results = [];

              els.forEach((a) => {
                const href = a.href;

                const isInvalidRoot =
                  href === "https://www.youtube.com/shorts/";

                if (href && href.includes("/shorts/") && !isInvalidRoot) {
                  const className = a.getAttribute("class") || "";

                  // SAME LOGIC AS YoutubeShort
                  if (
                    className.includes(
                      "shortsLockupViewModelHostOutsideMetadataEndpoint",
                    )
                  ) {
                    results.push({
                      url: href.split("?")[0],
                      caption: a.getAttribute("title")?.trim() || "",
                    });
                  }
                }
              });

              return results.filter(
                (item, index, self) =>
                  index === self.findIndex((x) => x.url === item.url),
              );
            });

          const newShorts = discoveredShorts.filter(
            (x) => !processedUrls.has(x.url),
          );

          if (!newShorts.length) {
            noNewContentCount++;

            if (noNewContentCount >= 3) {
              console.log(`${channel}: No new shorts found after 3 attempts`);
              break;
            }
          } else {
            noNewContentCount = 0;
          }

          // mark all as processed
          newShorts.forEach((short) => {
            processedUrls.add(short.url);
          });

          // only keep keyword matching shorts
          const keywordMatchedShorts = newShorts.filter((short) => {
            const caption = (short.caption || "").trim().toLowerCase();

            if (!caption) return false;

            return CREATOR_LOOKUP.some((creator) =>
              creator.allKeywords.some((keyword) => caption.includes(keyword)),
            );
          });

          if (keywordMatchedShorts.length === 0) {
            noKeywordMatchScrolls++;

            console.log(
              `${channel}: No keyword matches (${noKeywordMatchScrolls}/${MAX_NO_MATCH_SCROLLS})`,
            );
          } else {
            noKeywordMatchScrolls = 0;
          }

          if (noKeywordMatchScrolls >= MAX_NO_MATCH_SCROLLS) {
            console.log(
              `${channel}: No keyword matches found after ${MAX_NO_MATCH_SCROLLS} consecutive scrolls. Skipping channel.`,
            );

            break;
          }

          console.log(
            `${channel}: ${newShorts.length} new shorts, ${keywordMatchedShorts.length} keyword matches`,
          );

          let oldShortsCount = 0;

          for (const short of keywordMatchedShorts) {
            processedUrls.add(short.url);

            let shortPage;

            try {
              shortPage = await browser.newPage();

              await shortPage.goto(short.url, {
                waitUntil: "domcontentloaded",
                timeout: 60000,
              });

              await shortPage.waitForTimeout(1000);

              const shortInfo = await shortPage.evaluate(() => {
                const player = window.ytInitialPlayerResponse;

                const micro = player?.microformat?.playerMicroformatRenderer;

                return {
                  publishDate: micro?.publishDate || micro?.uploadDate || null,
                };
              });

              if (!shortInfo?.publishDate) {
                continue;
              }

              const shortDate = new Date(shortInfo.publishDate);

              if (shortDate < fromDate) {
                oldShortsCount++;
              }

              const caption = (short.caption || "").toLowerCase();

              const matchedCreators = CREATOR_LOOKUP.filter((creator) =>
                creator.allKeywords.some((keyword) =>
                  caption.includes(keyword),
                ),
              ).map((creator) => creator.name);

              if (!matchedCreators.length) {
                continue;
              }
              if (shortDate >= fromDate && shortDate <= toDate) {
                const shortData = {
                  creators: matchedCreators,
                  url: short.url,
                  caption: short.caption,
                  publishDate: shortInfo.publishDate,
                  channel,
                };

                matchingShorts.push(shortData);

                for (const creatorName of matchedCreators) {
                  const bucket = creatorCache[creatorName];

                  if (!bucket) continue;

                  if (!bucket.seenPosts) {
                    bucket.seenPosts = new Set();
                  }

                  if (bucket.seenPosts.has(short.url)) {
                    continue;
                  }

                  bucket.seenPosts.add(short.url);

                  bucket.data.push(shortData);

                  bucket.totalPosts++;
                }
              }
            } catch (err) {
              console.log("Short error:", err.message);
            } finally {
              if (shortPage) {
                await shortPage.close();
              }
            }
          }

          console.log(`${channel}: Matched ${matchingShorts.length} Shorts`);

          if (
            keywordMatchedShorts.length > 0 &&
            oldShortsCount >=
              Math.max(3, Math.floor(keywordMatchedShorts.length * 0.7))
          ) {
            console.log(`${channel}: Reached date range limit`);

            stopScrolling = true;
            break;
          }

          await page.mouse.wheel(0, 15000);

          await page.waitForTimeout(2000);
        }

        if (scrollCount >= MAX_SCROLLS) {
          console.log(`${channel}: Reached max scroll limit (${MAX_SCROLLS})`);
        }

        await page.close();
      } catch (err) {
        console.log(err);
      }
    }

    const creatorResults = Object.values(creatorCache).map((creator) => ({
      ...creator,
      seenPosts: undefined,
    }));

    for (const creator of creatorResults) {
      await savePlatformData({
        creatorName: creator.creator,
        platform: "youtubeShorts",
        posts: creator.data,
      });
    }

    return {
      success: true,
      totalCreators: creatorResults.length,
      data: creatorResults,
    };
  } catch (error) {
    console.log(error);

    return {
      success: false,
      error: error.message,
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

// ─── YOUTUBE & INSTAGRAM: SUBSCRIBER & FOLLOWER COUNTS ────────────────────────────────────────

export async function syncCreatorFollowers() {
  const browser = await chromium.launch({
    headless: true,
  });

  const page = await browser.newPage({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/137.0.0.0 Safari/537.36",
  });

  try {
    for (const creator of CREATOR_NAMES) {
      try {
        let instagramFollowers = 0;
        let youtubeSubscribers = null;

        // ----------------------------------
        // Instagram Followers
        // ----------------------------------
        const instagramHandle = creator.instagram || null;

        if (instagramHandle) {
          try {
            const response = await rapidApiFetch(
              "https://instagram120.p.rapidapi.com/api/instagram/userInfo",
              {
                method: "POST",
                headers: {
                  "x-rapidapi-host": "instagram120.p.rapidapi.com",
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  username: instagramHandle,
                }),
              },
            );

            const data = await response.json();

            instagramFollowers = data?.result?.[0]?.user?.follower_count || 0;
          } catch (err) {
            console.log(`${creator.name} instagram failed`, err.message);
          }
        }

        // ----------------------------------
        // Youtube Subscribers
        // ----------------------------------
        const youtubeHandle = creator.channelName || null;

        if (youtubeHandle) {
          try {
            await page.goto(`https://www.youtube.com/${youtubeHandle}`, {
              waitUntil: "networkidle",
              timeout: 60000,
            });

            await page.waitForTimeout(2000);

            youtubeSubscribers = await page
              .locator('span[aria-label*="subscribers"]')
              .first()
              .textContent();

            youtubeSubscribers =
              youtubeSubscribers?.trim()?.split(/\s+/)[0] || null;
          } catch (err) {
            console.log(`${creator.name} youtube failed`, err.message);
          }
        }

        // ----------------------------------
        // Update Existing Creator Config
        // ----------------------------------
        await SocialDumpStore.findOneAndUpdate(
          {
            creatorName: creator.name,
          },
          {
            $set: {
              instaFCount: instagramFollowers,
              youtubeFCount: youtubeSubscribers,
            },
          },
          {
            returnDocument: "after",
          },
        );

        console.log(`${creator.name} updated`, {
          instagramFollowers,
          youtubeSubscribers,
        });

        await sleep(1000);
      } catch (err) {
        console.log(`${creator.name} failed`, err.message);
      }
    }

    console.log("Creator follower sync completed");
  } catch (err) {
    console.log("Follower sync failed", err);
    throw err;
  } finally {
    await browser.close();
  }
}
