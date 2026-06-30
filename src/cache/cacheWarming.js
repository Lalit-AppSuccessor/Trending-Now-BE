import { creatorPageFeed } from "../functions/creatorPageFeed.js";
import { homePageFeed } from "../functions/homePageFeed.js";
import Creator from "../models/Creator.js";
import { CACHING_KEYS } from "./cacheKeys.js";

export async function cacheWarming() {
  console.info("cache warming started...");

  try {
    // Home Page Feed warming up
    const key1 = CACHING_KEYS.HomepageFeedKey;
    await homePageFeed(key1);

    // Creators Page Feed warming up
    const topInfluencers = (
      await Creator.find({}, "name -_id").sort({ trendingScore: -1 }).lean()
    ).map((c) => c.name);

    for (const creator of topInfluencers) {
      const key2 = CACHING_KEYS.CreatorPageFeedKey + creator;
      await creatorPageFeed(key2, creator);
    }
    console.info("cache warming completed.");
  } catch (error) {
    console.error("cache warming failed !!", error);
  }
}
