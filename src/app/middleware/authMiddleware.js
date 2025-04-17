const Joi = require("joi");
const jwt = require("jsonwebtoken");

// Schema Joi for register
const registerSchema = Joi.object({
  fullName: Joi.string().max(255).required().messages({
    "string.max": `Full name should have a maximum length of {#limit}`,
  }),
  email: Joi.string().email().required().messages({
    "string.email": `Email should be a valid email`,
  }),
  account: Joi.string().required(),
  password: Joi.string().min(6).required(),
});

// Schema Joi for login
const loginSchema = Joi.object({
  account: Joi.string().required(),
  password: Joi.string().required(),
  rememberMe: Joi.boolean().messages({
    "boolean.base": `Remember me should be a boolean`,
  }),
});

// Schema Joi for change password
const changePasswordSchema = Joi.object({
  oldPassword: Joi.string().required(),
  newPassword: Joi.string().min(6).required(),
});

// Schema Joi for forgot password
const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email": `Email should be a valid email`,
  }),
});

// Schema Joi for reset password
const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  password: Joi.string().min(6).required(),
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

const validateRegister = validate(registerSchema);
const validateLogin = validate(loginSchema);
const validateChangePassword = validate(changePasswordSchema);
const validateForgotPassword = validate(forgotPasswordSchema);
const validateResetPassword = validate(resetPasswordSchema);

// Verify token middleware
const verifyToken = (req, res, next) => {
  const token = req.header("Authorization");
  if (!token) {
    return res
      .status(401)
      .json({ error: "Access denied. You need to login to continue" });
  }

  const [bearer, authToken] = token.split(" ");
  try {
    const decoded = jwt.verify(authToken, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

module.exports = {
  validateRegister,
  validateLogin,
  validateChangePassword,
  validateForgotPassword,
  validateResetPassword,
  verifyToken,
};
