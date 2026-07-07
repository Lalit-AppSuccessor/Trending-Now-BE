// models/Article.js

import mongoose from "mongoose";

const ArticleSchema = new mongoose.Schema(
  {
    title: String,

    description: String,

    content: String,

    author: String,

    url: {
      type: String,
      unique: true,
    },

    urlToImage: String,

    source: {
      id: String,
      name: String,
    },

    publishedAt: Date,

    creatorName: String,

    isBreaking: {
      type: Boolean,
      default: false,
    },

    isAlsoHappening: {
      type: Boolean,
      default: false,
    },

    trendingScore: {
      type: Number,
      default: 0,
    },

    reactions: {
      like: {
        type: Number,
        default: 0,
      },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export default mongoose.model("Article", ArticleSchema);
