const mongoose = require("mongoose");

const LectureVideoPermissionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
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
  permissionType: {
    type: String,
    enum: ["OWNER", "VIEWER", "EDITOR"],
    required: true,
  },
});

module.exports = mongoose.model(
  "LectureVideoPermission",
  LectureVideoPermissionSchema
);
