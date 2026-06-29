import express from "express";
import jwt from "jsonwebtoken";

import Article from "../models/ArticleStore.js";
import Creator from "../models/Creator.js";
import User from "../models/User.js";
import { normaliseCreator } from "../utils/normalizer.js";
import SocialDumpStore from "../models/SocialDumpStore.js";
import SocialAllDump from "../models/SocialAllDump.js";
import ArticleStore from "../models/ArticleStore.js";
import { collectPosts, StackPostMaker } from "../utils/feedHelper.js";

const router = express.Router();

// FEED API
router.get("/homepage", async (req, res) => {
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
        return res.status(404).json({
          success: false,
          error: `Creator "${creator.name}" not found`,
        });
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
        },
        topHeadline: topHeadline,
        topicSlug: topicSlug,
        PostStack: PostStack,
      };

      posts.push(creatorFeed);
    }

    res.json({
      success: true,
      data: posts,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
    });
  }
});

router.post("/:id/stance", async (req, res) => {
  try {
    const { id } = req.params;
    const { stance } = req.body;
    if (!id && !stance) {
      return res.status(400).json({
        success: false,
        message: "Article ID and stance are required",
      });
    }

    const article = await Article.findOneAndUpdate(
      { _id: id },
      { $inc: { [`stances.${stance}`]: 1 } },
      { returnDocument: "after" },
    );

    res.json({
      success: true,
      article,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
    });
  }
});

router.post("/:id/like-toggle", async (req, res) => {
  try {
    const { id } = req.params;

    // GET TOKEN
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const token = authHeader.split(" ")[1];

    // VERIFY TOKEN
    const decoded = jwt.verify(token, process.env.JWT_SECRET_ACCESS);

    // FIND USER
    const user = await User.findOne({
      firebaseUid: decoded.firebaseUid,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // CREATE ARRAY IF NOT EXISTS
    if (!user.likedNews) {
      user.likedNews = [];
    }

    // CHECK IF ALREADY LIKED
    const alreadyLiked = user.likedNews.some(
      (newsId) => newsId.toString() === id,
    );

    // TOGGLE LIKE
    if (alreadyLiked) {
      user.likedNews = user.likedNews.filter(
        (newsId) => newsId.toString() !== id,
      );
    } else {
      user.likedNews.push(id);
    }

    await user.save();

    res.json({
      success: true,
      liked: !alreadyLiked,
      likedNews: user.likedNews,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
});

export default router;
