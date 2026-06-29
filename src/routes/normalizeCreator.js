import express from "express";
import { normaliseCreator } from "../utils/normalizer.js";
import SocialDumpStore from "../models/SocialDumpStore.js";
import ArticleStore from "../models/ArticleStore.js";
import SocialAllDump from "../models/SocialAllDump.js";
import { CACHING_KEYS } from "../cache/cacheKeys.js";
import { creatorPageFeed } from "../functions/creatorPageFeed.js";

const router = express.Router();

router.get("/:creatorName", async (req, res) => {
  if (!req.params.creatorName) {
    console.log("creator name missing!!");
    return;
  }

  const creatorName = req.params.creatorName;
  const key = CACHING_KEYS.CreatorPageFeedKey + creatorName;

  const response = await creatorPageFeed(key, creatorName);

  if (!response.success) {
    return res.status(500).json(response.error);
  }
  return res.status(200).json(response.data);
});

export default router;
