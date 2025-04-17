const mongoose = require("mongoose");

const InstantLectureSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    lectureName: { type: String, required: true },
    teachingStyle: { type: String, required: true },
    languageCode: { type: String, required: true },
    voiceType: { type: String, required: true },
    history: [
      {
        role: { type: String, required: true, enum: ["user", "model"] },
        text: { type: String },
        imageUrl: { type: String },
        _id: false,
      },
    ],
    cacheName: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("InstantLecture", InstantLectureSchema);
