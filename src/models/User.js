import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    firebaseUid: {
      type: String,
      required: [true, "Uid is required"],
      unique: true,
      trim: true,
      immutable: true,
    },

    username: {
      type: String,
      required: [true, "Username is required"],
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
      match: [
        /^[a-zA-Z0-9_.]+$/,
        "Username can only contain letters, numbers, underscore and dot",
      ],
    },

    firstName: {
      type: String,
      trim: true,
      default: null,
    },

    lastName: {
      type: String,
      trim: true,
      default: null,
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Please enter a valid email"],
    },

    profileImage: {
      type: String,
      default: null,
    },

    location: {
      type: String,
      trim: true,
      default: null,
    },

    likedNews: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Article",
      },
    ],

    // bio: {
    //   type: String,
    //   maxlength: 250,
    //   default: "",
    //   trim: true,
    // },

    // followers: [
    //   {
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: "User",
    //   },
    // ],

    // following: [
    //   {
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: "User",
    //   },
    // ],

    isVerified: {
      type: Boolean,
      default: false,
    },

    lastLogin: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    id: false,
  },
);

// indexes
UserSchema.index({ location: 1 });

// virtual counts
// UserSchema.virtual("followersCount").get(function () {
//   return this.followers.length;
// });

// UserSchema.virtual("followingCount").get(function () {
//   return this.following.length;
// });

// include virtuals in JSON response
UserSchema.set("toJSON", {
  virtuals: true,
});

UserSchema.set("toObject", {
  virtuals: true,
});

export default mongoose.model("User", UserSchema);
