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
    return res.status(500).json(response);
  }
  return res.status(200).json(response);
});

export default router;
