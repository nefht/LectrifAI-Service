const Joi = require("joi");

// Schema Joi for create chat message
const createChatMessageSchema = Joi.object({
  lectureId: Joi.string().required(),
  lectureScriptId: Joi.string().required(),
  message: Joi.string().required(),
});

const validateCreateChatMessage = (req, res, next) => {
  const { error } = createChatMessageSchema.validate(req.body, {
    abortEarly: false,
  });

  if (error) {
    const errorMessages = error.details.map((err) => err.message);
    return res.status(400).json({ error: errorMessages });
  }
  next();
};

module.exports = {
  validateCreateChatMessage,
};
