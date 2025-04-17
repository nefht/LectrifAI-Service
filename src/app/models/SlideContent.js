const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const SlideContentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, maxLength: 255 },

    // Case 1: Short topic / Documetn text
    topicText: { type: String },
    topicParagraph: { type: String },

    // Case 2: File (docx, pptx, pdf)
    topicFileId: {
      type: Schema.Types.ObjectId,
      ref: "UploadedFile",
    },

    writingTone: { type: String, required: true },
    language: { type: String, required: true },
    numberOfSlides: { type: Number, required: true },
    templateCode: { type: String, required: true },
    specificRequirements: { type: String },
    slideData: { type: Object, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SlideContent", SlideContentSchema);
