import express from "express";
import { normaliseCreator } from "../utils/normalizer.js";
import SocialDumpStore from "../models/SocialDumpStore.js";
import ArticleStore from "../models/ArticleStore.js";
import SocialAllDump from "../models/SocialAllDump.js";

const router = express.Router();

router.get("/:creatorName", async (req, res) => {
  if (!req.params.creatorName) {
    console.log("creator name missing!!");
    return;
  }

  const creatorConfig = await SocialDumpStore.findOne({
    creatorName: req.params.creatorName,
  }).lean();

  const rawDoc = await SocialAllDump.find({
    creatorName: req.params.creatorName,
  })
    .sort({
      scrapeDate: -1,
    })
    .lean();

  const newsDoc = await ArticleStore.find({
    creatorName: req.params.creatorName,
  }).lean();

  if (rawDoc.length === 0 && newsDoc.length === 0) {
    return res.status(404).json({
      success: false,
      error: `Creator "${req.params.creatorName}" not found`,
    });
  }

  const data = normaliseCreator(creatorConfig, rawDoc, newsDoc);

  res.json({
    success: true,
    data,
  });
});

export default router;
