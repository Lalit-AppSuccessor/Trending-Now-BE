import express from "express";
import {
  FacebookPosts,
  InstagramPosts,
  YoutubePosts,
  YoutubeShorts,
} from "../scraper/socialMediaScraper.js";

const router = express.Router();

router.get("/instagram/:creator", InstagramPosts);

router.get("/facebook/:creator", FacebookPosts);

router.get("/youtube/:creator", YoutubePosts);

router.get("/youtube/shorts/:creator", YoutubeShorts);

export default router;
