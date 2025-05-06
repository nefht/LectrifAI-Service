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
  topicFileId: Joi.string().required(),
  writingTone: Joi.string().required(),
  language: Joi.string().max(50).required(),
  numberOfSlides: Joi.number().integer().min(1).max(40).required(),
  templateCode: Joi.string().required(),
});

const slideRequestSchemaV3 = Joi.object({
  topicParagraph: Joi.string().min(100).max(40000).required(),
  writingTone: Joi.string().required(),
  language: Joi.string().max(50).required(),
  numberOfSlides: Joi.number().integer().min(1).max(40).required(),
  templateCode: Joi.string().required(),
});

const updateSlideContentSchema = Joi.object({
  slideData: Joi.object().required(),
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
const validateUpdateSlideContent = validate(updateSlideContentSchema);

module.exports = {
  validateSlideRequestV1,
  validateSlideRequestV2,
  validateSlideRequestV3,
  validateUpdateSlideContent,
};
