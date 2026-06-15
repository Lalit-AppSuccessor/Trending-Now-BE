import mongoose from "mongoose";

const SocialAllDumpSchema = new mongoose.Schema(
  {
    creatorName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    dumpStoreId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SocialDumpStore",
      required: true,
    },

    scrapeDate: {
      type: Date,
      required: true,
      index: true,
    },

    instagram: {
      type: mongoose.Schema.Types.Mixed,
      default: [],
    },

    twitter: {
      type: mongoose.Schema.Types.Mixed,
      default: [],
    },

    youtubeShorts: {
      type: mongoose.Schema.Types.Mixed,
      default: [],
    },

    expireAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

SocialAllDumpSchema.index(
  {
    expireAt: 1,
  },
  {
    expireAfterSeconds: 0,
  },
);

SocialAllDumpSchema.index({
  creatorName: 1,
  scrapeDate: -1,
});

export default mongoose.model("SocialAllDump", SocialAllDumpSchema);
