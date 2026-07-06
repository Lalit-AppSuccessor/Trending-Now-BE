import express from "express";

import {
  createOrLoginUser,
  deleteComment,
  deleteUser,
  getComments,
  getUserById,
  refreshToken,
  updateUser,
  createComment,
} from "../controllers/userprofileControls.js";

import { authMiddleware } from "../middleware/authVerify.js";

const router = express.Router();

router.post("/", createOrLoginUser);

router.get("/", authMiddleware, getUserById);

router.patch("/", authMiddleware, updateUser);

router.delete("/", authMiddleware, deleteUser);

router.post("/refresh", refreshToken);

router.post("/comment", authMiddleware, createComment);

router.get("/comment/:postId", getComments);

router.delete("/comment", authMiddleware, deleteComment);

export default router;
