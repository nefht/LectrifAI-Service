const mongoose = require("mongoose");

const ClassroomLectureVideoSchema = new mongoose.Schema(
  {
    classroomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Classroom",
      required: true,
    },
    lectureVideoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LectureVideo",
      required: true,
    },
    lectureScriptId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LectureScript",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "ClassroomLectureVideo",
  ClassroomLectureVideoSchema
);
