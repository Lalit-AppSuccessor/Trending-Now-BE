import express from "express";
import { normaliseCreator } from "../utils/normalizer.js";
import SocialDumpStore from "../models/SocialDumpStore.js";
import ArticleStore from "../models/ArticleStore.js";

const router = express.Router();

router.get("/:creatorName", async (req, res) => {
  if (!req.params.creatorName) {
    console.log("creator name missing!!");
    return;
  }

  const rawDoc = await SocialDumpStore.find({
    creatorName: req.params.creatorName,
  }).lean();

  const newsDoc = await ArticleStore.find({
    creatorName: req.params.creatorName,
  }).lean();

  if (rawDoc.length === 0 && newsDoc.length === 0) {
    return res.status(404).json({
      success: false,
      error: `Creator "${req.params.creatorName}" not found`,
    });
  }

  const data = normaliseCreator(rawDoc, newsDoc);

  res.json({
    success: true,
    data,
  });
});

export default router;
