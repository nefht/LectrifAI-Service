const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const UploadedFileSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    fileName: { type: String, trim: true, required: true },
    fileSize: { type: Number, required: true },
    fileUrl: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("UploadedFile", UploadedFileSchema);
