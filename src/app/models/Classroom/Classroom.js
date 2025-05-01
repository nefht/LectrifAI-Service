const mongoose = require("mongoose");

const ClassroomSchema = new mongoose.Schema(
  {
    classroomName: { type: String, required: true },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    inviteToken: { type: String, default: null },
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Classroom", ClassroomSchema);
