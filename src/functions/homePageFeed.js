import cache from "../cache/caching.js";
import ArticleStore from "../models/ArticleStore.js";
import Creator from "../models/Creator.js";
import SocialAllDump from "../models/SocialAllDump.js";
import SocialDumpStore from "../models/SocialDumpStore.js";
import { collectPosts, StackPostMaker } from "../utils/feedHelper.js";
import { normaliseCreator } from "../utils/normalizer.js";

export async function homePageFeed(key, forceRefresh = false) {
  if (!forceRefresh) {
    const cached = cache.get(key);
    if (cached) {
      console.log("Serving from cache");
      return {
        success: true,
        data: cached,
      };
    }
  }

  try {
    const topInfluencers = await Creator.find().sort({
      trendingScore: -1,
    });

    let posts = [];

    for (const creator of topInfluencers) {
      const topics = {};

      const creatorConfig = await SocialDumpStore.findOne({
        creatorName: creator.name,
      }).lean();

      const rawDoc = await SocialAllDump.find({
        creatorName: creator.name,
      })
        .sort({
          scrapeDate: -1,
        })
        .lean();

      const newsDoc = await ArticleStore.find({
        creatorName: creator.name,
      }).lean();

      if (rawDoc.length === 0 && newsDoc.length === 0) {
        return {
          success: false,
          error: `Creator "${creator.name}" not found`,
        };
      }

      const data = normaliseCreator(creatorConfig, rawDoc, newsDoc);

      const allposts = collectPosts(data);

      allposts.forEach((post) => {
        const topic = post?.topicMeta;

        if (!topic?.slug) return;

        topics[topic.slug] ??= {
          slug: topic.slug,
          label: topic.label,
          posts: [],
        };

        topics[topic.slug].posts.push(post);
      });

      const sortedTopics = Object.values(topics).sort(
        (a, b) => b.posts.length - a.posts.length,
      );

      const PostStack = await StackPostMaker(creator.name, sortedTopics);

      const topHeadline = sortedTopics[0]?.posts?.[0] && {
        _id: sortedTopics[0].posts[0]._id || sortedTopics[0].posts[0].id,
        headline: sortedTopics[0].posts[0].normalizedText,
      };

      const topicSlug = sortedTopics.map((s) => s.slug);

      const creatorFeed = {
        creatorSlug: {
          name: creator.name,
          trendingScore: creator.trendingScore.toFixed(2),
          image: creator.image,
          accentColor: creator.accentColor,
        },
        topHeadline: topHeadline,
        topicSlug: topicSlug,
        PostStack: PostStack,
      };

      posts.push(creatorFeed);
    }

    // caching updated data
    cache.set(key, posts);

    return {
      success: true,
      data: posts,
    };
  } catch (error) {
    console.log(error);

    return {
      success: false,
      error: "Server Error",
    };
  }
}
