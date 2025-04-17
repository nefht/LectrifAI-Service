const mongoose = require("mongoose");

const ClassroomQuizSchema = new mongoose.Schema(
  {
    classroomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Classroom",
      required: true,
    },
    quizId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quiz",
      required: true,
    },
    startTime: { type: Date }, // Thời gian mở làm bài
    endTime: { type: Date }, // Thời gian đóng làm bài
    duration: { type: Number }, // Thời gian làm bài (phút)
  },
  { timestamps: true }
);

module.exports = mongoose.model("ClassroomQuiz", ClassroomQuizSchema);
