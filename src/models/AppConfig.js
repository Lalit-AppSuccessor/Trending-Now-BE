import mongoose from "mongoose";

const AppConfigSchema = new mongoose.Schema(
  {
    androidMinVersion: {
      type: String,
    },
    iosMinVersion: {
      type: String,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export default mongoose.model("AppConfig", AppConfigSchema);
