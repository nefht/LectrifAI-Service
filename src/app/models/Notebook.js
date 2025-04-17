const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const NotebookSchema = new Schema(
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
    content: {
      type: Object,
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notebook", NotebookSchema);
