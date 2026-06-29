import cache from "../cache/caching.js";
import ArticleStore from "../models/ArticleStore.js";
import SocialAllDump from "../models/SocialAllDump.js";
import SocialDumpStore from "../models/SocialDumpStore.js";
import { normaliseCreator } from "../utils/normalizer.js";

export async function creatorPageFeed(key, creatorName) {
  const cached = cache.get(key);

  if (cached) {
    console.log("Serving from cache");
    return { success: true, data: cached };
  }

  try {
    const creatorConfig = await SocialDumpStore.findOne({
      creatorName: creatorName,
    }).lean();

    const rawDoc = await SocialAllDump.find({
      creatorName: creatorName,
    })
      .sort({
        scrapeDate: -1,
      })
      .lean();

    const newsDoc = await ArticleStore.find({
      creatorName: creatorName,
    }).lean();

    if (rawDoc.length === 0 && newsDoc.length === 0) {
      return {
        success: false,
        error: `Creator "${creatorName}" not found`,
      };
    }

    const data = normaliseCreator(creatorConfig, rawDoc, newsDoc);

    // caching updated data
    cache.set(key, data);

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.log(error);

    return {
      success: false,
      error: "Server Error",
    };
  }
}
