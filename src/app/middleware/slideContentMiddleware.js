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
const slideRequestSchemaV1 = Joi.object({
  topicText: Joi.string().max(255).required(),
  writingTone: Joi.string().required(),
  language: Joi.string().max(50).required(),
  numberOfSlides: Joi.number().integer().min(1).max(50).required(),
  templateCode: Joi.string().required(),
  specificRequirements: Joi.string().allow("").optional(),
});

const slideRequestSchemaV2 = Joi.object({
  topicFile: Joi.object({
    fileName: Joi.string().required(),
    fileSize: Joi.number().min(1),
    fileUrl: Joi.string().uri().required(),
  }).required(),
  writingTone: Joi.string().required(),
  language: Joi.string().max(50).required(),
  numberOfSlides: Joi.number().integer().min(1).max(50).required(),
  templateCode: Joi.string().required(),
});

const slideRequestSchemaV3 = Joi.object({
  topicParagraph: Joi.string().min(100).max(8000).required(),
  writingTone: Joi.string().required(),
  language: Joi.string().max(50).required(),
  numberOfSlides: Joi.number().integer().min(1).max(50).required(),
  templateCode: Joi.string().required(),
});

// Middleware validate request
const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      const errorMessages = error.details.map((err) => err.message);
      return res.status(400).json({ error: errorMessages });
    }
    next();
  };
};

const validateSlideRequestV1 = validate(slideRequestSchemaV1);
const validateSlideRequestV2 = validate(slideRequestSchemaV2);
const validateSlideRequestV3 = validate(slideRequestSchemaV3);

module.exports = {
  validateSlideRequestV1,
  validateSlideRequestV2,
  validateSlideRequestV3,
};
