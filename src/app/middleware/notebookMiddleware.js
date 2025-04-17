const Joi = require("joi");

// Schema Joi for update notebook
const updateNotebookSchema = Joi.object({
  content: Joi.object().required(),
});

const validateUpdateNotebook = (req, res, next) => {
  const { error } = updateNotebookSchema.validate(req.body, {
    abortEarly: false,
  });

  if (error) {
    const errorMessages = error.details.map((err) => err.message);
    return res.status(400).json({ error: errorMessages });
  }
  next();
};

module.exports = {
  validateUpdateNotebook,
};
