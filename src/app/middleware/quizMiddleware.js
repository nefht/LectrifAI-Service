const Joi = require("joi");

// Schema for creating quiz
const createQuizSchema = Joi.object({
  topic: Joi.string().allow(null).optional(),
  documentText: Joi.string().allow(null).optional(),
  lectureVideoId: Joi.string().optional(),
  academicLevel: Joi.string().required(),
  language: Joi.string().required(),
  questionType: Joi.string().required(),
  numberOfQuestions: Joi.number().integer().min(1).max(40).required(),
  specificRequirements: Joi.string().optional().allow(""),
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
  numberOfQuestions: Joi.number().integer().min(1).max(40).required(),
  specificRequirements: Joi.string().optional().allow(""),
});

// Schema for checking short answer
const checkShortAnswerSchema = Joi.object({
  question: Joi.string().required(),
  answer: Joi.string().required(),
  explanation: Joi.string().optional(),
  points: Joi.number().integer().min(1).max(10).required(),
  userAnswer: Joi.string().required(),
});

const updateQuizInfoSchema = Joi.object({
  quizName: Joi.string().required(),
  academicLevel: Joi.string().required(),
});

const updateQuizSchema = Joi.object({
  quizData: Joi.object({
    quizzes: Joi.array()
      .items(
        Joi.object({
          question: Joi.string().allow("").allow(null).required(),
          answer: Joi.string().allow("").allow(null).required(),
          options: Joi.array()
            .items(Joi.string().allow("").allow(null))
            .optional(),
          questionType: Joi.string()
            .valid("multiple choice", "short answer")
            .required(),
          points: Joi.number().required(),
          explanation: Joi.string().allow("").allow(null).optional(),
        })
      )
      .required(),
  }).required(),
});

const shareQuizSchema = Joi.object({
  isPublic: Joi.boolean().required(),
  sharedWith: Joi.array()
    .items(
      Joi.object({
        userId: Joi.string(),
        permissionType: Joi.string().valid("OWNER", "VIEWER", "EDITOR"),
      }).unknown()
    )
    .optional(),
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
const validateUpdateQuizInfo = validate(updateQuizInfoSchema);
const validateUpdateQuiz = validate(updateQuizSchema);
const validateShareQuiz = validate(shareQuizSchema);

module.exports = {
  validateCreateQuiz,
  validateCreateQuizFromFile,
  validateCheckShortAnswer,
  validateUpdateQuizInfo,
  validateUpdateQuiz,
  validateShareQuiz,
};
