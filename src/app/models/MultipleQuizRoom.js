const mongoose = require("mongoose");

const MultipleQuizRoomSchema = new mongoose.Schema(
  {
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
    timeLimit: {
      type: Number,
      required: true,
    },
    startedAt: {
      type: Date,
      default: Date.now(),
    },
    maxPlayers: {
      type: Number,
    },
    players: [{
      userId: { 
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      account: {
        type: String,
        required: true,
      },
      fullName: {
        type: String,
        required: true,
      },
      score: {
        type: Number,
        default: 0,
      },
    }],
    inviteToken: {
      type: String,
      required: true, // Thêm token mời phòng
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("MultipleQuizRoom", MultipleQuizRoomSchema);
