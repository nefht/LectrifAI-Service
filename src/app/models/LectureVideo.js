const { required } = require("joi");
const mongoose = require("mongoose");

const LectureVideoSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    fileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UploadedSlide",
      required: true,
    },
    lectureScriptId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LectureScript",
      required: true,
    },
    lectureName: { type: String, required: true },
    languageCode: { type: String, required: true },
    voiceType: { type: String, required: true },
    lectureSpeed: { type: String, required: true },
    videoUrl: { type: String, required: true },
    quizTimestamps: { type: [Number], default: [] },
    interactiveQuiz: { type: Boolean, default: false },
    isPublic: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("LectureVideo", LectureVideoSchema);
