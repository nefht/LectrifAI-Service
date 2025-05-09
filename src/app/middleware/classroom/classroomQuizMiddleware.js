const Joi = require("joi");

const updateClassroomQuizSchema = Joi.object({
  startTime: Joi.date().optional().messages({
    "date.base": `Start time must be a valid date`,
    "date.format": `Start time must be a valid date format`,
  }),
  endTime: Joi.date().optional().messages({
    "date.base": `End time must be a valid date`,
    "date.format": `End time must be a valid date format`,
  }),
  duration: Joi.number().integer().min(0).optional(),
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

const validateUpdateClassroomQuiz = validate(updateClassroomQuizSchema);

module.exports = {
  validateUpdateClassroomQuiz,
};
