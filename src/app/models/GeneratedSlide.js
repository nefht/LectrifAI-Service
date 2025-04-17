const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const GeneratedSlideSchema = new Schema(
  {
    slideContentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SlideContent",
      required: true,
    },
    templateCode: {
      type: String,
      required: true, 
    },
    fileUrl: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("GeneratedSlide", GeneratedSlideSchema);
