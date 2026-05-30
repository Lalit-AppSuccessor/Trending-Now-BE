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
    const rawUrl = req.query.url;

    if (!rawUrl) {
      return res.status(400).send("Missing URL");
    }

    const url = decodeURIComponent(rawUrl);
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    let referer = "https://www.google.com/";

    if (
      host.includes("instagram") ||
      host.includes("cdninstagram") ||
      host.includes("fbcdn")
    ) {
      referer = "https://www.instagram.com/";
    } else if (
      host.includes("twimg.com") ||
      host.includes("twitter.com") ||
      host.includes("x.com")
    ) {
      referer = "https://x.com/";
    } else if (host.includes("youtube.com")) {
      referer = "https://www.youtube.com/";
    } else if (host.includes("ytimg.com")) {
      referer = "https://www.youtube.com/";
    } else if (host.includes("facebook.com")) {
      referer = "https://www.facebook.com/";
    }

    console.log("================================");
    console.log("Original URL:", url);
    console.log("Host:", host);

    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",

        Accept:
          "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",

        "Accept-Language": "en-US,en;q=0.9",

        Referer: referer,

        Origin: referer,

        Connection: "keep-alive",
      },
    });

    console.log("Status:", response.status);
    console.log("Final URL:", response.url);
    console.log("Content-Type:", response.headers.get("content-type"));

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error("Fetch failed:", response.status);
      console.error(text.substring(0, 500));

      return res.status(response.status).send({
        success: false,
        status: response.status,
        url,
        finalUrl: response.url,
      });
    }

    const contentType =
      response.headers.get("content-type") || "application/octet-stream";

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.removeHeader("Cross-Origin-Resource-Policy");
    res.removeHeader("Cross-Origin-Embedder-Policy");

    res.set({
      "Content-Type": contentType,
      "Content-Length": buffer.length,

      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,HEAD,OPTIONS",
      "Access-Control-Allow-Headers": "*",

      "Cross-Origin-Resource-Policy": "cross-origin",

      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    });

    return res.end(buffer);
  } catch (error) {
    console.error("Proxy Error:", error);

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.options("/proxy", (_, res) => {
  res.set({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,HEAD,OPTIONS",
    "Access-Control-Allow-Headers": "*",
  });

  res.sendStatus(204);
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
