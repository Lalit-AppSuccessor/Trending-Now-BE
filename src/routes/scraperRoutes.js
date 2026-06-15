import express from "express";
import {
  InstagramPosts,
  TwitterPosts,
  YoutubeShorts,
} from "../scraper/socialMediaScraper.js";

const router = express.Router();

router.get("/instagram/", InstagramPosts);

router.get("/twitter/", TwitterPosts);

router.get("/youtube/shorts/", YoutubeShorts);

export default router;
