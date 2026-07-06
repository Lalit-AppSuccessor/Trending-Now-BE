import jwt from "jsonwebtoken";
import {
  generateUniqueUsername,
  isUsernameAvailable,
} from "../utils/usernameGen.js";
import SocialAllDump from "../models/SocialAllDump.js";
import User from "../models/User.js";
import mongoose from "mongoose";
import Comment from "../models/Comment.js";
import ArticleStore from "../models/ArticleStore.js";

// REGISTER OR LOGIN
export const createOrLoginUser = async (req, res) => {
  try {
    const { firebaseUid, firstName, lastName, email, profileImage } = req.body;

    // REQUIRED CHECK
    if (!firebaseUid) {
      return res.status(400).json({
        success: false,
        message: "Firebase UID is required",
      });
    }

    // FIND EXISTING USER
    let user = await User.findOne({
      firebaseUid,
    });

    let isNewUser = false;

    // CREATE NEW USER
    if (!user) {
      isNewUser = true;

      const usernamePicker = await generateUniqueUsername(email);
      console.log(usernamePicker);

      user = await User.create({
        firebaseUid,
        username: usernamePicker,
        firstName,
        lastName,
        email,
        profileImage,
      });
    }

    // CREATE APP JWT TOKENS
    const accessToken = jwt.sign(
      {
        userId: user._id,
        firebaseUid: user.firebaseUid,
      },
      process.env.JWT_SECRET_ACCESS,
      {
        expiresIn: process.env.JWT_ACCESS_EXPIRY_TIME,
      },
    );

    const refreshToken = jwt.sign(
      {
        userId: user._id,
        firebaseUid: user.firebaseUid,
      },
      process.env.JWT_SECRET_REFRESH,
      {
        expiresIn: process.env.JWT_REFRESH_EXPIRY_TIME,
      },
    );

    return res.status(200).json({
      success: true,
      message: isNewUser ? "User registered successfully" : "Login successful",
      tokens: { accessToken, refreshToken },
      data: user,
    });
  } catch (error) {
    console.log("User register/login failed:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// GET SINGLE USER
export const getUserById = async (req, res) => {
  try {
    const firebase_uid = req.auth_firebase_uid || "";

    const user = await User.findOne({ firebaseUid: firebase_uid }).lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// UPDATE USER
export const updateUser = async (req, res) => {
  try {
    const firebase_uid = req.auth_firebase_uid || "";
    const updates = { ...req.body };

    const existingUser = await User.findOne({
      firebaseUid: firebase_uid,
    });

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (updates.username) {
      const username = updates.username.trim().toLowerCase();

      const usernameChanged = username !== existingUser.username;

      if (usernameChanged) {
        const available = await isUsernameAvailable(username);

        if (!available) {
          return res.status(400).json({
            success: false,
            message: "Username taken",
          });
        }
      }

      updates.username = username.trim().toLowerCase();
    }

    // prevent firebaseUid update
    if (updates.firebaseUid) {
      delete updates.firebaseUid;
    }

    console.log(updates);
    const user = await User.findOneAndUpdate(
      { firebaseUid: firebase_uid },
      updates,
      {
        returnDocument: "after",
        runValidators: true,
      },
    ).lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: user,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// DELETE USER
export const deleteUser = async (req, res) => {
  try {
    const firebase_uid = req.auth_firebase_uid || "";

    const user = await User.findOneAndDelete({
      firebaseUid: firebase_uid,
    }).lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// GENERATE NEW ACCESS TOKEN USING REFRESH TOKEN
export const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Refresh token is required",
      });
    }

    // VERIFY REFRESH TOKEN
    jwt.verify(
      refreshToken,
      process.env.JWT_SECRET_REFRESH,
      async (err, decoded) => {
        if (err) {
          return res.status(403).json({
            success: false,
            message: "Invalid or expired refresh token",
          });
        }

        // CREATE NEW ACCESS TOKEN
        const accessToken = jwt.sign(
          {
            userId: decoded.userId,
            firebaseUid: decoded.firebaseUid,
          },
          process.env.JWT_SECRET_ACCESS,
          {
            expiresIn: process.env.JWT_ACCESS_EXPIRY_TIME,
          },
        );

        return res.status(200).json({
          success: true,
          accessToken,
        });
      },
    );
  } catch (e) {
    console.log("REFRESH TOKEN ERROR:", e);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// USER COMMENTS
export const createComment = async (req, res) => {
  try {
    const firebase_uid = req.auth_firebase_uid;
    const { source, headline, topic, postId, comment } = req.body;

    let is_stack = false;

    if (!firebase_uid || !source || !postId || !comment) {
      return res.status(400).json({
        success: false,
        message: "Required fields missing",
      });
    }

    const user = await User.findOne({ firebaseUid: firebase_uid }).lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const articleExists = await ArticleStore.exists({
      _id: postId,
    });

    const postExists = await SocialAllDump.exists({
      $or: [
        { "instagram.postId": postId },
        { "twitter.tweetId": postId },
        { "youtubeShorts.shortId": postId },
      ],
    });

    if (!postExists || !articleExists) {
      return res.status(404).json({
        success: false,
        message: "Post/Article does not exist",
      });
    }

    if (topic) {
      is_stack = true;
    }

    const newComment = {
      _id: new mongoose.Types.ObjectId(),
      user_id: user._id,
      comment,
      eventDate: new Date(),
    };

    const data = await Comment.findOneAndUpdate(
      { postId },
      {
        $setOnInsert: {
          postId,
          source,
          headline,
          topic,
          is_stack,
        },
        $push: {
          comments: newComment,
        },
      },
      {
        returnDocument: "after",
        upsert: true,
      },
    );

    return res.status(201).json({
      success: true,
      message: "Comment added successfully",
      data,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

export const getComments = async (req, res) => {
  try {
    const { postId } = req.params;

    const comments = await Comment.findOne({ postId })
      .populate("comments.user_id", "username profilePic")
      .lean();

    if (!comments) {
      return res.status(200).json({
        success: true,
        data: [],
      });
    }

    return res.status(200).json({
      success: true,
      data: comments,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

export const deleteComment = async (req, res) => {
  try {
    const firebase_uid = req.auth_firebase_uid;
    const { postId, commentId } = req.body;

    const user = await User.findOne({
      firebaseUid: firebase_uid,
    }).lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const result = await Comment.findOneAndUpdate(
      {
        postId,
      },
      {
        $pull: {
          comments: {
            _id: commentId,
            user_id: user._id,
          },
        },
      },
      {
        returnDocument: "after",
      },
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Comment deleted successfully",
      data: result,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
