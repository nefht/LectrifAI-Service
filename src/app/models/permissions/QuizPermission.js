const mongoose = require("mongoose");

const QuizPermissionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  quizId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Quiz",
    required: true,
  },
  permissionType: {
    type: String,
    enum: ["OWNER", "VIEWER", "EDITOR"],
    required: true,
  },
});

module.exports = mongoose.model("QuizPermission", QuizPermissionSchema);
