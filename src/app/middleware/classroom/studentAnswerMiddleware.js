const Joi = require("joi");

const startQuizSchema = Joi.object({
    classroomQuizId: Joi.string().required()
});

const updateStudentAnswerSchema = Joi.object({
    userAnswers: Joi.array().items(Joi.object()).required(),
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

const validateStartQuiz = validate(startQuizSchema);
const validateUpdateStudentAnswer = validate(updateStudentAnswerSchema);

module.exports = {
    validateStartQuiz,
    validateUpdateStudentAnswer
}