import * as cheerio from "cheerio";
import { chromium } from "playwright";
import SocialDumpStore from "../models/SocialDumpStore.js";
import { containsUsername } from "../utils/creatorNameRegex.js";
import { CREATOR_NAMES } from "../constants/keywords.js";

// ─── Shared Browser Context (Instagram/imginn) ───────────────────────────────

let igContext = null;

async function initIgBrowser() {
  if (igContext) return;
  igContext = await chromium.launchPersistentContext("./imginn-session", {
    channel: "chrome",
    headless: false,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
      "--disable-dev-shm-usage",
    ],
    viewport: { width: 1366, height: 768 },
  });

  if (process.env.CF_CLEARANCE) {
    await igContext.addCookies([
      {
        name: "cf_clearance",
        value: process.env.CF_CLEARANCE,
        domain: "imginn.com",
        path: "/",
        secure: true,
        httpOnly: true,
      },
    ]);
  }
  console.log("Instagram browser initialized");
}

// Date parser
const parseRelativeDate = (text) => {
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

// ─── Helper: scrape a single imginn post page ────────────────────────────────

async function scrapeImginnPost(postUrl) {
  let postPage;

  try {
    postPage = await igContext.newPage();

    await postPage.goto(`https://imginn.com${postUrl}`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await postPage.waitForTimeout(2000);

    const html = await postPage.content();

    const $ = cheerio.load(html);

    // CAPTION
    const caption = $("meta[property='og:description']").attr("content") || "";

    // HASHTAGS
    const hashtags = caption.match(/#\w+/g) || [];

    const media = [];

    // ONLY INSIDE MEDIA WRAP
    $(".media-wrap").each((_, wrap) => {
      // IMAGES
      $(wrap)
        .find("img")
        .each((_, el) => {
          const src = $(el).attr("src") || $(el).attr("data-src");

          if (src && src.startsWith("http")) {
            media.push({
              type: "image",
              url: src,
            });
          }
        });

      // VIDEOS
      $(wrap)
        .find("video")
        .each((_, el) => {
          const videoSrc =
            $(el).attr("src") || $(el).find("source").attr("src");

          const poster = $(el).attr("poster") || null;

          if (videoSrc && videoSrc.startsWith("http")) {
            media.push({
              type: "video",
              url: videoSrc,
              poster,
            });
          }
        });
    });

    // REMOVE DUPLICATES
    const uniqueMedia = media.filter(
      (item, idx, self) =>
        idx ===
        self.findIndex((x) => x.url === item.url && x.type === item.type),
    );

    // DATE
    const rawText = $(".time").text();
    console.log(rawText);
    const date =
      rawText.match(
        /(\d+\s+(seconds?|minutes?|hours?|days?|weeks?|months?|years?)\s+ago|a\s+(second|minute|hour|day|week|month|year)\s+ago)/i,
      )?.[0] || null;

    return {
      shortcode: postUrl.replace("/p/", "").replace(/\//g, ""),

      postUrl: `https://imginn.com${postUrl}`,

      caption,

      hashtags,

      date,

      mediaCount: uniqueMedia.length,

      media: uniqueMedia,
    };
  } catch (e) {
    console.log("IMGinn scrape error:", e.message);

    return null;
  } finally {
    if (postPage && !postPage.isClosed()) {
      await postPage.close();
    }
  }
}

// facebook Id finder
async function facebookPageId(fbhandle) {
  try {
    const apiKey = process.env.RAPIDAPI_KEY;

    let fbUrl = fbhandle;

    if (!fbhandle.startsWith("http")) {
      fbUrl = `https://facebook.com/${fbhandle}`;
    }

    const encodedUrl = encodeURIComponent(fbUrl);

    const url = `https://facebook-scraper3.p.rapidapi.com/page/page_id?url=${encodedUrl}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "x-rapidapi-key": apiKey,
        "x-rapidapi-host": "facebook-scraper3.p.rapidapi.com",
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    console.log("Facebook ID Response:", data);

    return data?.page_id || null;
  } catch (error) {
    console.log("Facebook Page ID Error:", error);

    return null;
  }
}

// ─── INSTAGRAM: profile posts ────────────────────────────────────────────────

export const InstagramPosts = async (req, res) => {
  let page;

  try {
    await initIgBrowser();

    const { creator } = req.params;

    const { usernames } = req.body;

    if (!Array.isArray(usernames) || usernames.length === 0) {
      return res.status(400).json({
        success: false,
        error: "usernames array required",
      });
    }

    const creatorData = CREATOR_NAMES.find(
      (a) => a.name.toLowerCase() === creator.toLowerCase(),
    );

    const matchKeywords = [
      creator?.toLowerCase(),

      ...(creatorData?.keywords || []).map((k) => k.toLowerCase()),
    ].filter(Boolean);

    // LAST 2 MONTHS FILTER
    const twoMonthsAgo = new Date();

    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 5);

    const allInstagramData = [];

    for (const username of usernames) {
      page = await igContext.newPage();

      try {
        await page.goto(`https://imginn.com/${username}/`, {
          waitUntil: "domcontentloaded",
          timeout: 120000,
        });

        await page.waitForTimeout(3000);

        // ZOOM OUT
        await page.evaluate(() => {
          document.body.style.zoom = "20%";
        });

        // CLICK LOAD MORE BUTTON IF PRESENT
        // DYNAMIC LOAD MORE + SCROLL
        let stopLoading = false;

        let loadCount = 0;

        while (!stopLoading && loadCount < 50) {
          try {
            // REMOVE COOKIE / CONSENT POPUP
            await page.evaluate(() => {
              document
                .querySelectorAll(
                  ".fc-dialog-overlay, .fc-message-root, .fc-consent-root",
                )
                .forEach((el) => el.remove());
            });

            // GET CURRENT HTML
            const currentHtml = await page.content();

            const $$ = cheerio.load(currentHtml);

            let oldPostFound = false;

            // CHECK DATES
            $$(".item").each((_, item) => {
              const dateText = $$(item).find(".time").text().trim();

              const parsedDate = parseRelativeDate(dateText);

              // STOP IF POSTS OLDER THAN RANGE FOUND
              if (
                parsedDate &&
                !isNaN(parsedDate) &&
                parsedDate < twoMonthsAgo
              ) {
                oldPostFound = true;
              }
            });

            // STOP LOADING
            if (oldPostFound) {
              console.log("Old posts reached. Stopping scroll.");

              stopLoading = true;

              break;
            }

            // LOAD MORE BUTTON
            const loadMoreBtn = await page.$("button.load-more");

            if (loadMoreBtn) {
              await loadMoreBtn.scrollIntoViewIfNeeded();

              await page.waitForTimeout(1500);

              await loadMoreBtn.click({
                force: true,
              });

              console.log(`Load more clicked ${loadCount + 1}`);
            } else {
              // FALLBACK SCROLL
              await page.mouse.wheel(0, 5000);
            }

            loadCount++;

            await page.waitForTimeout(4000);
          } catch (e) {
            console.log("Dynamic loading failed:", e.message);

            break;
          }
        }

        await page.waitForTimeout(3000);

        // // EXTRA SCROLL
        // await page.evaluate(async () => {
        //   await new Promise((resolve) => {
        //     let totalHeight = 0;

        //     const distance = 1000;

        //     const timer = setInterval(() => {
        //       window.scrollBy(0, distance);

        //       totalHeight += distance;

        //       if (
        //         totalHeight >= document.body.scrollHeight ||
        //         totalHeight > 15000
        //       ) {
        //         clearInterval(timer);

        //         resolve();
        //       }
        //     }, 400);
        //   });
        // });

        await page.waitForTimeout(3000);

        const html = await page.content();

        const $ = cheerio.load(html);

        const previewPosts = [];

        // LOOP POST CARDS
        $(".item").each((_, item) => {
          // POST URL
          const href = $(item).find(".img a").attr("href");

          if (!href?.includes("/p/")) return;

          // TIME
          const dateText = $(item).find(".time").text().trim();

          // PARSE DATE
          const parsedDate = parseRelativeDate(dateText);
          console.log(
            parsedDate,
            !isNaN(parsedDate),
            parsedDate >= twoMonthsAgo,
            twoMonthsAgo,
          );
          // ONLY LAST 2 MONTHS
          const isRecent =
            parsedDate && !isNaN(parsedDate) && parsedDate >= twoMonthsAgo;

          if (!isRecent) return;

          // PREVIEW TEXT
          const previewText = `
            ${$(item).text()}
            ${$(item).find("img").attr("alt") || ""}
            ${$(item).find(".download").attr("aria-label") || ""}
          `
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();

          // KEYWORD MATCH
          const isMatch = matchKeywords.some((keyword) =>
            previewText.includes(keyword),
          );

          if (!isMatch) return;

          previewPosts.push({
            href,
            date: dateText,
          });
        });

        // REMOVE DUPLICATES
        const uniqueLinks = [
          ...new Map(previewPosts.map((item) => [item.href, item])).values(),
        ].slice(0, 20);

        const posts = [];

        // ONLY OPEN FILTERED POSTS
        for (const post of uniqueLinks) {
          const data = await scrapeImginnPost(post.href);

          if (!data) continue;

          const isKeywordMatch = matchKeywords.some((keyword) =>
            `${data.caption || ""} ${data.hashtags?.join(" ") || ""}`
              .toLowerCase()
              .includes(keyword),
          );

          if (isKeywordMatch) {
            posts.push(data);
          }
        }

        allInstagramData.push({
          username,

          scrapedAt: new Date(),

          scannedPosts: uniqueLinks.length,

          totalPosts: posts.length,

          data: posts,
        });
      } catch (err) {
        allInstagramData.push({
          username,
          error: err.message,
        });
      } finally {
        if (page && !page.isClosed()) {
          await page.close();
        }
      }
    }

    await SocialDumpStore.findOneAndUpdate(
      {
        creatorName: creator,
      },
      {
        $set: {
          creatorName: creator,

          instagram: allInstagramData,
        },
      },
      {
        upsert: true,

        returnDocument: "after",
      },
    );

    return res.json({
      success: true,

      totalAccounts: allInstagramData.length,

      data: allInstagramData,
    });
  } catch (e) {
    console.log(e);

    return res.status(500).json({
      success: false,

      error: e.message,
    });
  } finally {
    const existingPages = igContext.pages();

    for (const p of existingPages) {
      try {
        const url = p.url();
        console.log(url);
        if (url === "about:blank" || url === "" || url === "chrome://newtab/") {
          await p.close();
        }
      } catch {}
    }
  }
};
// ─── FACEBOOK: page posts (RapidAPI) ─────────────────────────────────────────

export const FacebookPosts = async (req, res) => {
  try {
    const { creator } = req.params;
    const { fbhandles } = req.body;

    if (!Array.isArray(fbhandles) || fbhandles.length === 0) {
      return res.status(400).json({
        success: false,
        error: "fbhandles array required",
      });
    }

    const apiKey = process.env.RAPIDAPI_KEY;

    const allFacebookData = [];

    for (const fbhandle of fbhandles) {
      try {
        const pageId = await facebookPageId(fbhandle);

        if (!pageId) {
          allFacebookData.push({
            fbhandle,
            error: "Page ID not found",
          });

          continue;
        }

        const url = `https://facebook-scraper3.p.rapidapi.com/page/posts?page_id=${pageId}`;

        const response = await fetch(url, {
          method: "GET",
          headers: {
            "x-rapidapi-key": apiKey,
            "x-rapidapi-host": "facebook-scraper3.p.rapidapi.com",
            "Content-Type": "application/json",
          },
        });

        const data = await response.json();
        console.log(data);
        const filteredPosts =
          data?.results?.filter((post) => {
            console.log(post.author.name);
            return containsUsername(`${post.author.name || ""}`, creator);
          }) || [];

        allFacebookData.push({
          fbhandle,
          pageId,
          scrapedAt: new Date(),
          totalPosts: filteredPosts.length,
          data: filteredPosts,
        });
      } catch (err) {
        allFacebookData.push({
          fbhandle,
          error: err.message,
        });
      }
    }

    await SocialDumpStore.findOneAndUpdate(
      {
        creatorName: creator,
      },
      {
        $set: {
          creatorName: creator,
          facebook: allFacebookData,
        },
      },
      {
        upsert: true,
        returnDocument: "after",
      },
    );

    return res.json({
      success: true,
      totalAccounts: allFacebookData.length,
      data: allFacebookData,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// ─── YOUTUBE: channel community posts ────────────────────────────────────────

export const YoutubePosts = async (req, res) => {
  const { creator } = req.params;
  const { channels } = req.body;

  if (!Array.isArray(channels) || channels.length === 0) {
    return res.status(400).json({
      success: false,
      error: "channels array required",
    });
  }

  let browser;

  try {
    browser = await chromium.launch({
      headless: true,
    });

    const allYoutubeData = [];

    for (const channel of channels) {
      try {
        let channelUrl = channel;

        if (channel.startsWith("@")) {
          channelUrl = `https://www.youtube.com/${channel}/posts`;
        } else if (!channel.startsWith("http")) {
          channelUrl = `https://www.youtube.com/@${channel}/posts`;
        }

        if (!channelUrl.includes("/posts")) {
          channelUrl = channelUrl.replace(/\/$/, "") + "/posts";
        }

        const page = await browser.newPage();

        await page.goto(channelUrl, {
          waitUntil: "networkidle",
          timeout: 120000,
        });

        for (let i = 0; i < 5; i++) {
          await page.mouse.wheel(0, 3000);
          await page.waitForTimeout(1500);
        }

        const posts = await page.evaluate(() => {
          const results = [];

          document
            .querySelectorAll("ytd-backstage-post-thread-renderer")
            .forEach((post) => {
              const media = [];

              post.querySelectorAll("img").forEach((img) => {
                if (img.src) {
                  media.push({
                    type: "image",
                    url: img.src,
                  });
                }
              });

              results.push({
                text:
                  post.querySelector("#content-text")?.innerText?.trim() ||
                  null,
                published:
                  post
                    .querySelector("#published-time-text a")
                    ?.innerText?.trim() || null,
                likes:
                  post.querySelector("#vote-count-middle")?.innerText?.trim() ||
                  null,
                media,
              });
            });

          return results;
        });

        // const filteredPosts = posts.filter((post) => {
        //   console.log(post);
        //   containsUsername(`${post.text || ""}`, creator);
        // });
        await page.close();

        allYoutubeData.push({
          channel,
          scrapedAt: new Date(),
          totalPosts: posts.length,
          data: posts,
        });
      } catch (err) {
        allYoutubeData.push({
          channel,
          error: err.message,
        });
      }
    }

    await SocialDumpStore.findOneAndUpdate(
      {
        creatorName: creator,
      },
      {
        $set: {
          creatorName: creator,
          youtube: allYoutubeData,
        },
      },
      {
        upsert: true,
        returnDocument: "after",
      },
    );

    return res.json({
      success: true,
      totalAccounts: allYoutubeData.length,
      data: allYoutubeData,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

export const YoutubeShorts = async (req, res) => {
  const { creator } = req.params;

  const { channels } = req.body;

  if (!Array.isArray(channels) || channels.length === 0) {
    return res.status(400).json({
      success: false,
      error: "channels array required",
    });
  }

  let browser;

  try {
    browser = await chromium.launch({
      headless: true,
    });

    const creatorConfigs = CREATOR_NAMES;

    const creatorKeywordMap = creatorConfigs.map((c) => ({
      creator: c.name,
      keywords: [
        c.name.toLowerCase(),
        ...(c.keywords || []).map((k) => k.toLowerCase()),
      ],
    }));

    const allYoutubeShortsData = [];

    for (const channel of channels) {
      try {
        let shortsUrl = channel;

        // BUILD SHORTS URL
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

        // WAIT FOR PAGE LOAD
        await page.waitForTimeout(5000);

        // SCROLL TO LOAD MORE SHORTS
        for (let i = 0; i < 12; i++) {
          await page.mouse.wheel(0, 4000);

          await page.waitForTimeout(1500);
        }

        // EXTRACT ONLY MATCHING SHORTS
        const shorts = await page
          .locator("a")
          .evaluateAll((els, creatorKeywordMap) => {
            const results = [];

            els.forEach((a) => {
              const href = a.href;

              const isInvalidRoot = href === "https://www.youtube.com/shorts/";

              if (href && href.includes("/shorts/") && !isInvalidRoot) {
                const className = a.getAttribute("class") || "";

                // ONLY VALID SHORTS CARDS
                if (
                  className.includes(
                    "shortsLockupViewModelHostOutsideMetadataEndpoint",
                  )
                ) {
                  const caption = a.getAttribute("title")?.trim() || "";

                  // KEYWORD MATCH
                  const matchedCreators = creatorKeywordMap
                    .filter((creatorObj) =>
                      creatorObj.keywords.some((keyword) =>
                        caption.toLowerCase().includes(keyword),
                      ),
                    )
                    .map((creatorObj) => creatorObj.creator);

                  if (!matchedCreators.length) return;

                  results.push({
                    url: href.split("?")[0],
                    caption,
                    creators: matchedCreators,
                  });
                }
              }
            });

            // REMOVE DUPLICATES
            return results.filter(
              (item, index, self) =>
                index === self.findIndex((x) => x.url === item.url),
            );
          }, creatorKeywordMap);

        console.log(shorts);

        await page.close();

        allYoutubeShortsData.push({
          channel,

          scrapedAt: new Date(),

          totalShorts: shorts.length,

          data: shorts,
        });
      } catch (err) {
        console.log(err);

        allYoutubeShortsData.push({
          channel,
          error: err.message,
        });
      }
    }

    const creatorBuckets = {};

    allYoutubeShortsData.forEach((account) => {
      if (!account.data) return;

      account.data.forEach((short) => {
        short.creators.forEach((creatorName) => {
          if (!creatorBuckets[creatorName]) {
            creatorBuckets[creatorName] = {};
          }

          if (!creatorBuckets[creatorName][account.channel]) {
            creatorBuckets[creatorName][account.channel] = {
              channel: account.channel,
              scrapedAt: account.scrapedAt,
              totalShorts: 0,
              data: [],
            };
          }

          creatorBuckets[creatorName][account.channel].data.push({
            url: short.url,
            caption: short.caption,
          });

          creatorBuckets[creatorName][account.channel].totalShorts =
            creatorBuckets[creatorName][account.channel].data.length;
        });
      });
    });

    const creatorData = Object.entries(creatorBuckets)
      .map(([creatorName, channels]) => ({
        creatorName,
        totalAccounts: Object.keys(channels).length,
        youtubeShorts: Object.values(channels),
      }))
      .filter((c) => c.totalAccounts > 0);

    // SAVE TO DB
    // await SocialDumpStore.findOneAndUpdate(
    //   {
    //     creatorName: creator,
    //   },
    //   {
    //     $set: {
    //       creatorName: creator,

    //       youtubeShorts: allYoutubeShortsData,
    //     },
    //   },
    //   {
    //     upsert: true,

    //     returnDocument: "after",
    //   },
    // );

    return res.json({
      success: true,
      totalCreators: creatorData.length,
      data: creatorData,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,

      error: error.message,
    });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

// export const YoutubeShorts = async (req, res) => {
//   const { creator } = req.params;
//   const { channels, months = 1 } = req.body;

//   if (!Array.isArray(channels) || channels.length === 0) {
//     return res.status(400).json({
//       success: false,
//       error: "channels array required",
//     });
//   }

//   let browser;

//   try {
//     browser = await chromium.launch({
//       headless: false,
//     });

//     const creatorData = CREATOR_NAMES.find(
//       (a) => a.name.toLowerCase() === creator.toLowerCase(),
//     );

//     const matchKeywords = [
//       creator?.toLowerCase(),
//       ...(creatorData?.keywords || []).map((k) => k.toLowerCase()),
//     ].filter(Boolean);

//     const toDate = new Date();

//     const fromDate = new Date();
//     fromDate.setMonth(fromDate.getMonth() - Number(months));

//     console.log(
//       `Filtering Shorts from ${fromDate.toISOString()} to ${toDate.toISOString()}`,
//     );

//     const allYoutubeShortsData = [];

//     for (const channel of channels) {
//       try {
//         let shortsUrl = channel;

//         if (channel.startsWith("@")) {
//           shortsUrl = `https://www.youtube.com/${channel}/shorts`;
//         } else if (!channel.startsWith("http")) {
//           shortsUrl = `https://www.youtube.com/@${channel}/shorts`;
//         }

//         if (!shortsUrl.includes("/shorts")) {
//           shortsUrl = shortsUrl.replace(/\/$/, "") + "/shorts";
//         }

//         console.log("Scraping:", shortsUrl);

//         const page = await browser.newPage();

//         await page.goto(shortsUrl, {
//           waitUntil: "networkidle",
//           timeout: 120000,
//         });

//         await page.setViewportSize({
//           width: 1920,
//           height: 4000,
//         });

//         await page.evaluate(() => {
//           document.body.style.zoom = "30%";
//         });

//         await page.waitForTimeout(3000);

//         const processedUrls = new Set();
//         const matchingShorts = [];

//         let stopScrolling = false;
//         let noNewContentCount = 0;

//         let scrollCount = 0;
//         const MAX_SCROLLS = 100;

//         let noKeywordMatchScrolls = 0;
//         const MAX_NO_MATCH_SCROLLS = 30;

//         while (!stopScrolling && scrollCount < MAX_SCROLLS) {
//           scrollCount++;

//           console.log(`${channel}: Scroll ${scrollCount}/${MAX_SCROLLS}`);
//           const discoveredShorts = await page.evaluate(() => {
//             const urls = [];

//             document.querySelectorAll('a[href*="/shorts/"]').forEach((a) => {
//               const href = a.href?.split("?")[0];

//               if (
//                 href &&
//                 href.includes("/shorts/") &&
//                 href !== "https://www.youtube.com/shorts/"
//               ) {
//                 urls.push({
//                   url: href,
//                   caption: (a.getAttribute("title") || "").trim(),
//                 });
//               }
//             });

//             return urls.filter(
//               (item, index, self) =>
//                 index === self.findIndex((x) => x.url === item.url),
//             );
//           });

//           const newShorts = discoveredShorts.filter(
//             (x) => !processedUrls.has(x.url),
//           );

//           if (!newShorts.length) {
//             noNewContentCount++;

//             if (noNewContentCount >= 3) {
//               console.log(`${channel}: No new shorts found after 3 attempts`);
//               break;
//             }
//           } else {
//             noNewContentCount = 0;
//           }

//           // mark all as processed
//           newShorts.forEach((short) => {
//             processedUrls.add(short.url);
//           });

//           // only keep keyword matching shorts
//           const keywordMatchedShorts = newShorts.filter((short) => {
//             const caption = (short.caption || "").trim().toLowerCase();

//             if (!caption) return false;

//             return matchKeywords.some((keyword) => caption.includes(keyword));
//           });

//           if (keywordMatchedShorts.length === 0) {
//             noKeywordMatchScrolls++;

//             console.log(
//               `${channel}: No keyword matches (${noKeywordMatchScrolls}/${MAX_NO_MATCH_SCROLLS})`,
//             );
//           } else {
//             noKeywordMatchScrolls = 0;
//           }

//           if (noKeywordMatchScrolls >= MAX_NO_MATCH_SCROLLS) {
//             console.log(
//               `${channel}: No keyword matches found after ${MAX_NO_MATCH_SCROLLS} consecutive scrolls. Skipping channel.`,
//             );

//             break;
//           }

//           console.log(
//             `${channel}: ${newShorts.length} new shorts, ${keywordMatchedShorts.length} keyword matches`,
//           );

//           let oldShortsCount = 0;

//           for (const short of keywordMatchedShorts) {
//             processedUrls.add(short.url);

//             let shortPage;

//             try {
//               shortPage = await browser.newPage();

//               await shortPage.goto(short.url, {
//                 waitUntil: "domcontentloaded",
//                 timeout: 60000,
//               });

//               await shortPage.waitForTimeout(1000);

//               const shortInfo = await shortPage.evaluate(() => {
//                 const player = window.ytInitialPlayerResponse;

//                 const micro = player?.microformat?.playerMicroformatRenderer;

//                 return {
//                   publishDate: micro?.publishDate || micro?.uploadDate || null,
//                 };
//               });

//               if (!shortInfo?.publishDate) {
//                 continue;
//               }

//               const shortDate = new Date(shortInfo.publishDate);

//               if (shortDate < fromDate) {
//                 oldShortsCount++;
//               }

//               const caption = (short.caption || "").toLowerCase();

//               const isKeywordMatch = matchKeywords.some((keyword) =>
//                 caption.includes(keyword),
//               );

//               if (
//                 isKeywordMatch &&
//                 shortDate >= fromDate &&
//                 shortDate <= toDate
//               ) {
//                 matchingShorts.push({
//                   url: short.url,
//                   caption: short.caption,
//                   publishDate: shortInfo.publishDate,
//                 });
//               }
//             } catch (err) {
//               console.log("Short error:", err.message);
//             } finally {
//               if (shortPage) {
//                 await shortPage.close();
//               }
//             }
//           }

//           console.log(`${channel}: Matched ${matchingShorts.length} Shorts`);

//           if (
//             keywordMatchedShorts.length > 0 &&
//             oldShortsCount >=
//               Math.max(3, Math.floor(keywordMatchedShorts.length * 0.7))
//           ) {
//             console.log(`${channel}: Reached date range limit`);

//             stopScrolling = true;
//             break;
//           }

//           await page.mouse.wheel(0, 15000);

//           await page.waitForTimeout(2000);
//         }

//         if (scrollCount >= MAX_SCROLLS) {
//           console.log(`${channel}: Reached max scroll limit (${MAX_SCROLLS})`);
//         }

//         await page.close();

//         allYoutubeShortsData.push({
//           channel,
//           scrapedAt: new Date(),
//           fromDate,
//           toDate,
//           totalShorts: matchingShorts.length,
//           data: matchingShorts,
//         });
//       } catch (err) {
//         console.log(err);

//         allYoutubeShortsData.push({
//           channel,
//           error: err.message,
//         });
//       }
//     }

//     await SocialDumpStore.findOneAndUpdate(
//       {
//         creatorName: creator,
//       },
//       {
//         $set: {
//           creatorName: creator,
//           youtubeShorts: allYoutubeShortsData,
//         },
//       },
//       {
//         upsert: true,
//         returnDocument: "after",
//       },
//     );

//     return res.json({
//       success: true,
//       months,
//       totalAccounts: allYoutubeShortsData.length,
//       data: allYoutubeShortsData,
//     });
//   } catch (error) {
//     console.log(error);

//     return res.status(500).json({
//       success: false,
//       error: error.message,
//     });
//   } finally {
//     if (browser) {
//       await browser.close();
//     }
//   }
// };
