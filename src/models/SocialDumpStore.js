import mongoose from "mongoose";

const PlatformStateSchema = new mongoose.Schema(
  {
    bootstrapCompleted: {
      type: Boolean,
      default: false,
    },

    lastScrapedAt: {
      type: Date,
      default: null,
    },

    latestPostDate: {
      type: Date,
      default: null,
    },
  },
  {
    _id: false,
  },
);

const SocialDumpSchema = new mongoose.Schema(
  {
    creatorName: {
      type: String,
      unique: true,
      trim: true,
    },

    instaFCount: {
      type: Number,
      default: 0,
    },

    youtubeFCount: {
      type: String,
      default: null,
    },

    platformState: {
      instagram: {
        type: PlatformStateSchema,
        default: () => ({}),
      },

      twitter: {
        type: PlatformStateSchema,
        default: () => ({}),
      },

      youtubeShorts: {
        type: PlatformStateSchema,
        default: () => ({}),
      },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export default mongoose.model("SocialDumpStore", SocialDumpSchema);
