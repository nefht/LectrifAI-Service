const Joi = require("joi");

// Schema for creating quiz
const createQuizSchema = Joi.object({
  topic: Joi.string().allow(null).optional(),
  documentText: Joi.string().allow(null).optional(),
  lectureVideoId: Joi.string().optional(),
  academicLevel: Joi.string().required(),
  language: Joi.string().required(),
  questionType: Joi.string().required(),
  numberOfQuestions: Joi.number().integer().min(1).max(30).required(),
  specificRequirements: Joi.string().optional(),
}).custom((value, helpers) => {
  // Kiểm tra nếu cả topic và documentText đều có giá trị hoặc đều null
  if (
    (value.topic === null || value.topic === "") &&
    (value.documentText === null || value.documentText === "")
  ) {
    return helpers.error("any.invalid"); // Lỗi nếu cả hai đều null hoặc trống
  }
  return value;
});

// Schema for creating quiz from file
const createQuizFromFileSchema = Joi.object({
  academicLevel: Joi.string().required(),
  language: Joi.string().required(),
  questionType: Joi.string().required(),
  numberOfQuestions: Joi.number().integer().min(1).max(30).required(),
  specificRequirements: Joi.string().optional(),
});

// Schema for checking short answer
const checkShortAnswerSchema = Joi.object({
  question: Joi.string().required(),
  answer: Joi.string().required(),
  explanation: Joi.string().optional(),
  points: Joi.number().integer().min(1).max(10).required(),
  userAnswer: Joi.string().required(),
});

const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, {
      abortEarly: false,
    });
    if (error) {
      const errorMessages = error.details.map((err) => err.message);
      return res.status(400).json({ error: errorMessages });
    }
    next();
  };
};

const validateCreateQuiz = validate(createQuizSchema);
const validateCreateQuizFromFile = validate(createQuizFromFileSchema);
const validateCheckShortAnswer = validate(checkShortAnswerSchema);

module.exports = {
  validateCreateQuiz,
  validateCreateQuizFromFile,
  validateCheckShortAnswer,
};
