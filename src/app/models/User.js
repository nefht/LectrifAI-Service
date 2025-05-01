const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const UserSchema = new Schema(
  {
    fullName: { type: String, required: true, maxLength: 255 },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    account: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Profile",
      default: null,
    },
    avatarUrl: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);
