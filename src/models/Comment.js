import mongoose from "mongoose";

const CommentSchema = new mongoose.Schema(
  {
    postId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    source: String,
    is_stack: { type: Boolean, default: false },
    topic: String,
    headline: String,

    comments: [
      {
        user_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        comment: {
          type: String,
          required: true,
          trim: true,
        },
        eventDate: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export default mongoose.model("Comment", CommentSchema);
