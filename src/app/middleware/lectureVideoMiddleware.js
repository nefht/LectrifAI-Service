const Joi = require("joi");

// Schema Joi for create lecture video
const createLectureVideoSchema = Joi.object({
  fileId: Joi.string().required(),
  lectureScriptId: Joi.string().required(),
  languageCode: Joi.string().required(),
  voiceType: Joi.string().required(),
  lectureSpeed: Joi.string().required(),
});

// Schema Joi for update lecture video
const updateLectureVideoSchema = Joi.object({
  lectureName: Joi.string(),
});

const shareLectureSchema = Joi.object({
  isPublic: Joi.boolean().required(),
  sharedWith: Joi.array()
    .items(
      Joi.object({
        userId: Joi.string().required(),
        permissionType: Joi.string().valid("OWNER", "VIEWER", "EDITOR").required(),
      }).unknown()
    )
    .optional(),
});

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

const validateCreateLectureVideo = validate(createLectureVideoSchema);
const validateUpdateLectureVideo = validate(updateLectureVideoSchema);
const validateShareLectureVideo = validate(shareLectureSchema);

module.exports = {
  validateCreateLectureVideo,
  validateUpdateLectureVideo,
  validateShareLectureVideo
};
