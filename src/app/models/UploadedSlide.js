const mongoose = require("mongoose");
const { EUploadedSlide } = require("../constants/uploaded-slide");
const Schema = mongoose.Schema;

const UploadedSlideSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    fileName: {
      type: String,
      required: true,
    },
    lectureId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lecture",
    },
    fileSize: { type: Number, required: true },
    fileUrl: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("UploadedSlide", UploadedSlideSchema);
