const mongoose = require("mongoose");

const StudentAnswerSchema = new mongoose.Schema(
  {
    classroomQuizId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClassroomQuiz",
      required: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    userAnswers: [{ type: Object, required: true }],
    quizTotalScore: { type: Number },
    score: { type: Number },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date },
    submittedAt: { type: Date },
    status: {
      type: String,
      enum: ["not started", "in-progress", "disconnected", "submitted", "graded"],
      default: "not started",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("StudentAnswer", StudentAnswerSchema);
