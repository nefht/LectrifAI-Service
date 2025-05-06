const Joi = require("joi");

const updateUserSchema = Joi.object({
  fullName: Joi.string().min(2).max(100).optional(),
  email: Joi.string().email().optional(),
  birthday: Joi.date().optional(),
  // Không cho phép cập nhật avatar tại đây
  avatarUrl: Joi.forbidden(),
});

const updateUserProfileSchema = Joi.object({
  bio: Joi.string().allow("").optional(),
  dateOfBirth: Joi.date().optional(),
  phoneNumber: Joi.string().allow("").optional(),
  isPublic: Joi.boolean().optional(),
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

const validateUpdateUser = validate(updateUserSchema);
const validateUpdateUserProfile = validate(updateUserProfileSchema);

module.exports = {
    validateUpdateUser,
    validateUpdateUserProfile,
}