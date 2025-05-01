const Joi = require("joi");
const mongoose = require("mongoose");

const lectureScriptSchema = Joi.object({
  fileId: Joi.string()
    .custom((value, helpers) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.message("Invalid fileId format.");
      }
      return value;
    })
    .required().messages({
      "string.empty": "You must upload a file.",
      "any.required": "You must upload a file.",
    }),
  academicLevel: Joi.string().required().messages({
    "string.empty": "Academic level has not been selected.",
  }),
  language: Joi.string().required().messages({
    "string.empty": "Language has not been selected.",
  }),
  voiceType: Joi.string().required().messages({
    "string.empty": "Voice type has not been selected.",
  }),
  backgroundMusic: Joi.string().allow("").optional(),
  voiceStyle: Joi.string().required().messages({
    "string.empty": "Voice style has not been selected.",
  }),
  lectureSpeed: Joi.string().required().messages({
    "string.empty": "Lecture speed has not been selected.",
  }),
  lectureLength: Joi.string().required().messages({
    "string.empty": "Lecture length has not been selected.",
  }),
  interactiveQuiz: Joi.boolean().required(),
  specificRequirements: Joi.string().allow("").optional(),
});

const updateLectureScriptSchema = Joi.object({
  lectureScript: Joi.object().required(),
});

const validateLectureScript = (req, res, next) => {
  const { error } = lectureScriptSchema.validate(req.body, {
    abortEarly: true,
  });

  if (error) {
    return res
      .status(400)
      .json({ error: error.details.map((detail) => detail.message) });
  }

  next();
};

const validateUpdateLectureScript = (req, res, next) => {
  const { error } = updateLectureScriptSchema.validate(req.body, {
    abortEarly: true,
  });

  if (error) {
    return res
      .status(400)
      .json({ error: error.details.map((detail) => detail.message) });
  }

  next();
}

module.exports = { validateLectureScript, validateUpdateLectureScript };
