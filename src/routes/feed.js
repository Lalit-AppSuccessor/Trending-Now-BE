import express from "express";
import jwt from "jsonwebtoken";
import cache from "../cache/caching.js";
import Article from "../models/ArticleStore.js";
import Creator from "../models/Creator.js";
import User from "../models/User.js";
import { normaliseCreator } from "../utils/normalizer.js";
import SocialDumpStore from "../models/SocialDumpStore.js";
import SocialAllDump from "../models/SocialAllDump.js";
import ArticleStore from "../models/ArticleStore.js";
import { collectPosts, StackPostMaker } from "../utils/feedHelper.js";
import { CACHING_KEYS } from "../cache/cacheKeys.js";
import { homePageFeed } from "../functions/homePageFeed.js";

const router = express.Router();

// FEED API
router.get("/homepage", async (req, res) => {
  const key = CACHING_KEYS.HomepageFeedKey;
  const response = await homePageFeed(key);
  if (!response.success) {
    return res.status(500).json(response.error);
  }
  return res.status(200).json(response.data);
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
