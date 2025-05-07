const Joi = require("joi");

const createClassroomSchema = Joi.object({
  classroomName: Joi.string().required().messages({
    "string.empty": `Classroom name is required`,
  }),
});

const addStudentsToClassroomSchema = Joi.object({
  studentIds: Joi.array().items(Joi.string()).min(1).required(),
});

const addQuizzesToClassroomSchema = Joi.object({
  quizzes: Joi.array()
    .items(
      Joi.object({
        quizId: Joi.string().required(),
        startTime: Joi.date().optional().messages({
          "date.base": `Start time must be a valid date`,
          "date.format": `Start time must be a valid date format`,
        }),
        endTime: Joi.date().optional().messages({
          "date.base": `End time must be a valid date`,
          "date.format": `End time must be a valid date format`,
        }),
        duration: Joi.number().integer().min(1).optional(),
      })
    )
    .min(1)
    .required(),
});

const addLecturesToClassroomSchema = Joi.object({
  lectureVideos: Joi.array().items(Joi.object({
    lectureVideoId: Joi.string().required(),
    lectureScriptId: Joi.string().required(),
  })).min(1).required(),
});

const removeStudentsFromClassroomSchema = Joi.object({
  studentIds: Joi.array().items(Joi.string()).min(1).required(),
});

const renameClassroomSchema = Joi.object({
  classroomName: Joi.string().required(),
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

const validateCreateClassroom = validate(createClassroomSchema);
const validateAddStudentsToClassroom = validate(addStudentsToClassroomSchema);
const validateAddQuizzesToClassroom = validate(addQuizzesToClassroomSchema);
const validateAddLecturesToClassroom = validate(addLecturesToClassroomSchema);
const validateRemoveStudentsFromClassroom = validate(
  removeStudentsFromClassroomSchema
);
const validateRenameClassroom = validate(renameClassroomSchema);

module.exports = {
  validateCreateClassroom,
  validateAddStudentsToClassroom,
  validateAddQuizzesToClassroom,
  validateAddLecturesToClassroom,
  validateRemoveStudentsFromClassroom,
  validateRenameClassroom,
};
