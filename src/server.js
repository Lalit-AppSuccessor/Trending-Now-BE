import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

import newsRoutes from "./routes/news.js";
import healthRoutes from "./routes/health.js";
import userRoutes from "./routes/userRoutes.js";
import { syncNewsFeed } from "./service/newsFetcher.js";

dotenv.config();

const app = express();

app.use(express.json());

app.use("/api/health", healthRoutes);
app.use("/api/news", newsRoutes);
app.use("/media", express.static(path.join(process.cwd(), "media")));
app.use("/api/user", userRoutes);

mongoose.connect(process.env.MONGO_URI);

app.listen(3000, "0.0.0.0", () => {
  console.log("Server running!!");
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
