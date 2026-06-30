import { compare } from "compare-versions";
import AppConfig from "../models/AppConfig.js";

export default async function versionCheck(req, res, next) {
  try {
    const appVersion = req.headers["x-app-version"];
    const platform = req.headers["x-platform"]?.toLowerCase();

    if (!appVersion || !platform) {
      return res.status(400).json({
        success: false,
        error: "App version and platform are required.",
      });
    }

    const config = await AppConfig.findOne().lean();

    if (!config) {
      return next();
    }

    const minimumVersion =
      platform === "android" ? config.androidMinVersion : config.iosMinVersion;

    if (!minimumVersion) {
      return next();
    }

    if (compare(appVersion, minimumVersion, "<")) {
      return res.status(426).json({
        success: false,
        forceUpdate: true,
        message: `Please update your app to version ${minimumVersion} or later.`,
        minimumVersion,
      });
    }

    next();
  } catch (err) {
    console.error("Version check failed:", err);
    next();
  }
}
