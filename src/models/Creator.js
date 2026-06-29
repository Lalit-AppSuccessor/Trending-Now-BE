import mongoose from "mongoose";

const CreatorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      unique: true,
    },

    channelName: {
      type: String,
    },

    trendingScore: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export default mongoose.model("Creator", CreatorSchema);
