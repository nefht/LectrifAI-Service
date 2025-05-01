const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ProfileSchema = new Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  bio: {
    type: String,
    default: "",
  },
  dateOfBirth: {
    type: Date,
    default: null,
  },
  phoneNumber: {
    type: String,
    default: "",
  },
  isPublic: {
    type: Boolean,
    default: false,
  },
});

module.exports = mongoose.model("Profile", ProfileSchema);
