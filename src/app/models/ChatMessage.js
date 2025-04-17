const mongoose = require("mongoose");

const ChatMessageSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    lectureId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LectureVideo",
      required: true,
    },
    history: [
      {
        role: { type: String, required: true, enum: ["user", "model"] },
        text: { type: String, required: true },
        _id: false,
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("ChatMessage", ChatMessageSchema);
