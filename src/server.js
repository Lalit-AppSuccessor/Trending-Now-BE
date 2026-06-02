import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import path, { normalize } from "path";

import newsRoutes from "./routes/news.js";
import healthRoutes from "./routes/health.js";
import userRoutes from "./routes/userRoutes.js";
import scraperRoutes from "./routes/scraperRoutes.js";
import normalizeCreator from "./routes/normalizeCreator.js";

import { syncNewsFeed } from "./service/newsFetcher.js";

dotenv.config();

const app = express();
app.use(cors());

app.use(express.json());

app.use("/api/health", healthRoutes);
app.use("/api/news", newsRoutes);
app.use("/api/social", scraperRoutes);
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
      parsed.hostname.includes("fbcdn.net")
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

setInterval(
  async () => {
    try {
      await syncNewsFeed();
    } catch (error) {
      console.error("syncNewsFeed error:", error);
    }
  },
  1000 * 60 * 60 * 24,
);
// await syncNewsFeed();
