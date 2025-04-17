// const Joi = require("joi");

// // Schema validation cho request
// const slideRequestSchema = Joi.object({
//   topic: Joi.string().max(255).required().messages({
//     "string.base": "Topic should be a string",
//     "string.empty": "Topic cannot be empty",
//     "any.required": "Topic is required",
//   }),
//   writingTone: Joi.string().optional(),
//   language: Joi.string().max(50).optional(),
//   numberOfSlides: Joi.number().integer().min(1).max(50).optional(),
//   specificRequirements: Joi.string().allow("").optional(),
// });

// // Middleware validate request
// const validateSlideRequest = (req, res, next) => {
//   const { error } = slideRequestSchema.validate(req.body);
//   if (error) {
//     return res
//       .status(400)
//       .json({ error: error.details.map((err) => err.message) });
//   }
//   next();
// };

// module.exports = {validateSlideRequest};

const Joi = require("joi");

// Schema validation cho request
const slideRequestSchema = Joi.object({
  // Case 1: Short topic
  topicText: Joi.string().max(255),
  
  // Case 2: File (docx, pptx, pdf)
  topicFile: Joi.object({
    fileName: Joi.string().required(),
    fileSize: Joi.number().min(1),
    fileUrl: Joi.string().uri().required(),
  }),

  // Case 3: Long paragraph
  topicParagraph: Joi.string().min(20).max(8000),
  writingTone: Joi.string().required(),
  language: Joi.string().max(50).required(),
  numberOfSlides: Joi.number().integer().min(1).max(50).required(),
  templateCode: Joi.string().required(),
  specificRequirements: Joi.string().allow("").optional(),
});

// Middleware validate request
const validateSlideRequest = (req, res, next) => {
  const { topicText, topicFileId, topicParagraph } = req.body;

  // Đảm bảo ít nhất 1 trong 3 trường `topicText`, `topicFileId`, hoặc `topicParagraph` có dữ liệu
  if (!topicText && !topicFileId && !topicParagraph) {
    return res.status(400).json({
      error: [
        "You must provide either topicText, topicFileId, or topicParagraph.",
      ],
    });
  }

  // Kiểm tra dữ liệu với Joi
  const { error } = slideRequestSchema.validate(req.body, {
    allowUnknown: true,
  });

  if (error) {
    return res.status(400).json({
      error: error.details.map((err) => err.message),
    });
  }

  next();
};

module.exports = { validateSlideRequest };
