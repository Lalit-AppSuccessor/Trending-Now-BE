import mongoose from "mongoose";

const SocialDumpSchema = new mongoose.Schema(
  {
    creatorName: {
      type: String,
      unique: true,
      trim: true,
    },
    instaPageName: { type: String, trim: true },
    facebookPage: {
      type: String,
      trim: true,
    },
    youtubeHandle: {
      type: String,
      trim: true,
    },
    instaFCount: {
      type: Number,
      default: 0,
    },
    youtubeFCount: {
      type: Number,
      default: 0,
    },

    instagram: {
      type: mongoose.Schema.Types.Mixed,

      default: null,
    },
    facebook: {
      type: mongoose.Schema.Types.Mixed,

      default: null,
    },
    youtube: {
      type: mongoose.Schema.Types.Mixed,

      default: null,
    },
    youtubeShorts: {
      type: mongoose.Schema.Types.Mixed,

      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export default mongoose.model("SocialDumpStore", SocialDumpSchema);
