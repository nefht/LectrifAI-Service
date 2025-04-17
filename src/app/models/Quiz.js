const mongoose = require("mongoose");

const QuizSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Case 1: From Topic
    topic: { type: String },
    // Case 2: From Document
    documentText: { type: String },
    fileUrl: { type: String },
    // Case 3: From LectureVideo
    lectureVideoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LectureVideo",
    },
    quizName: { type: String, required: true },
    academicLevel: { type: String, required: true },
    language: { type: String, required: true },
    questionType: { type: String, required: true },
    quizData: { type: Object, required: true },
    isPublic: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Quiz", QuizSchema);
