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

    stances: {
      support: {
        type: Number,
        default: 0,
      },
      oppose: {
        type: Number,
        default: 0,
      },
    },

    comments: [
      {
        user_id: {
          type: String,
          required: true,
          trim: true,
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
