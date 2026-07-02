import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import path, { normalize } from "path";

import feedRoutes from "./routes/feed.js";
import healthRoutes from "./routes/health.js";
import userRoutes from "./routes/userRoutes.js";
import normalizeCreator from "./routes/normalizeCreator.js";
import { syncNewsFeed } from "./scraper/newsFetcher.js";
import { syncInstagramMedia } from "./utils/mediaCDNWorker.js";
import {
  creatorTrendScoreCalc,
  InstagramPosts,
  syncCreatorFollowers,
  TwitterPosts,
  YoutubeShorts,
} from "./scraper/socialMediaScraper.js";
import { cacheWarming } from "./cache/cacheWarming.js";
import versionCheck from "./middleware/versionChecker.js";

dotenv.config();

const app = express();
app.use(cors());

app.use(express.json());
app.use("/api", versionCheck);

app.use("/api/health", healthRoutes);
app.use("/api/feed", feedRoutes);
app.use("/media", express.static(path.join(process.cwd(), "media")));
app.use("/api/user", userRoutes);
app.use("/api/creator", normalizeCreator);

app.get("/proxy", async (req, res) => {
  try {
    const url = decodeURIComponent(req.query.url);

    if (!url) {
      return res.status(400).send("Missing URL");
    }

    const parsed = new URL(url);

    let referer = "https://imginn.com/";

    if (
      parsed.hostname.includes("twitter.com") ||
      parsed.hostname.includes("twimg.com") ||
      parsed.hostname.includes("video.twimg.com")
    ) {
      referer = "https://twitter.com";
    }

    if (
      parsed.hostname.includes("instagram.com") ||
      parsed.hostname.includes("cdninstagram.com") ||
      parsed.hostname.includes("fbcdn.net") ||
      parsed.hostname.includes("instagram.fark1-1.fna")
    ) {
      referer = "https://www.instagram.com/";
    }

    const response = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/136.0.0.0 Safari/537.36",
        Referer: referer,
        Origin: referer,
        Accept: "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Sec-Fetch-Site": "cross-site",
        "Sec-Fetch-Mode": "cors",
      },
    });

    if (!response.ok) {
      return res.status(response.status).send("Image fetch failed");
    }

    const contentType =
      response.headers.get("content-type") || "application/octet-stream";

    const buffer = Buffer.from(await response.arrayBuffer());

    // IMPORTANT
    res.removeHeader("Cross-Origin-Resource-Policy");
    res.removeHeader("Cross-Origin-Embedder-Policy");

    res.set({
      "Content-Type": contentType,
      "Content-Length": buffer.length,
      "Cache-Control": "public,max-age=86400",
      "Access-Control-Allow-Origin": "*",
      "Cross-Origin-Resource-Policy": "cross-origin",
    });

    res.end(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).send("Proxy failed");
  }
});

mongoose.connect(process.env.MONGO_URI);

const port = process.env.PORT;

app.listen(port || 3000, "0.0.0.0", () => {
  console.log("Server running!!", port);
});

// ----------- Daily Scheduler (6AM) --------------

const runDailyAt6AM = () => {
  const now = new Date();

  const nextRun = new Date();
  nextRun.setHours(6, 0, 0, 0);

  // If it's already past 6 AM today, schedule for tomorrow
  if (now >= nextRun) {
    nextRun.setDate(nextRun.getDate() + 1);
    console.log("next day 6 am job set");
  }

  const initialDelay = nextRun.getTime() - now.getTime();

  setTimeout(() => {
    const executeJob = async () => {
      try {
        await syncNewsFeed();
        // await YoutubeShorts();
        await InstagramPosts();
        await TwitterPosts();
        await creatorTrendScoreCalc();
      } catch (error) {
        console.error("syncNewsFeed error:", error);
      } finally {
        await cacheWarming();
      }
    };

    // Run immediately at 6 AM
    executeJob();

    // Then run every 12 hours
    setInterval(executeJob, 12 * 60 * 60 * 1000);
  }, initialDelay);
};

runDailyAt6AM();

// ----------- Weekly Scheduler (6AM) --------------

const runEveryFridayAt6AM = () => {
  const now = new Date();

  const nextRun = new Date();
  nextRun.setHours(6, 0, 0, 0);

  // Calculate days until next Friday (Friday = 5)
  const daysUntilFriday = (5 - now.getDay() + 7) % 7;

  nextRun.setDate(now.getDate() + daysUntilFriday);

  // If it's already past 6 AM on Friday, schedule for next Friday
  if (daysUntilFriday === 0 && now >= nextRun) {
    nextRun.setDate(nextRun.getDate() + 7);
    console.log("next Friday 6 AM job set");
  }

  const initialDelay = nextRun.getTime() - now.getTime();

  setTimeout(() => {
    const executeWeeklyJob = async () => {
      try {
        await syncCreatorFollowers();
      } catch (error) {
        console.error("Weekly job error:", error);
      }
    };

    // Run at the scheduled Friday 6 AM
    executeWeeklyJob();

    // Then every 7 days
    setInterval(executeWeeklyJob, 7 * 24 * 60 * 60 * 1000);
  }, initialDelay);
};

// runEveryFridayAt6AM();

// ----------- Testing function calls --------------

// await cacheWarming();

// await syncNewsFeed();
// syncInstagramMedia().catch(console.error);
// await syncCreatorFollowers();
await YoutubeShorts();
// await InstagramPosts();
// await TwitterPosts();
// await creatorTrendScoreCalc()
