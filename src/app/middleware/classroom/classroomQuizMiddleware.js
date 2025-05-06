const Joi = require("joi");

const updateClassroomQuizSchema = Joi.object({
  startTime: Joi.date().optional(),
  endTime: Joi.date().optional(),
  duration: Joi.number().integer().min(1).optional(),
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
