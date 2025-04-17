const mongoose = require("mongoose");

const LectureScriptSchema = new mongoose.Schema(
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
    lectureScript: { type: Object, required: true },
    academicLevel: { type: String, required: true },
    language: { type: String, required: true },
    voiceType: { type: String, required: true },
    backgroundMusic: { type: String, default: "" },
    voiceStyle: { type: String, required: true },
    lectureSpeed: { type: String, required: true },
    lectureLength: { type: String, required: true },
    interactiveQuiz: { type: Boolean, default: false },
    specificRequirements: { type: String, default: "" },
    isPublic: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("LectureScript", LectureScriptSchema);
