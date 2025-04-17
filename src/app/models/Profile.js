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
  academicLevel: {
    type: String,
    enum: [
      "School",
      "High School",
      "Undergraduate",
      "Postgraduate",
      "Researcher",
    ],
    required: true,
  },
  preferences: {
    language: {
      type: String,
      default: "English",
    },
    lectureLevel: {
      type: String,
      enum: ["Beginner", "Intermediate", "Advanced"],
      default: "Intermediate",
    },
    presentationStyle: {
      type: String,
      enum: ["Concise", "Detailed"],
      default: "Concise",
    },
    notificationsEnabled: {
      type: Boolean,
      default: true,
    },
  },
});

module.exports = mongoose.model("Profile", ProfileSchema);
