const express = require("express");
const router = express.Router();

const authController = require("../app/controllers/AuthController");
const {
  validateRegister,
  validateLogin,
  validateChangePassword,
  verifyToken,
  validateForgotPassword,
  validateResetPassword,
} = require("../app/middleware/authMiddleware");

router.post("/register", validateRegister, authController.register);
router.post("/login", validateLogin, authController.login);
router.put(
  "/change-password",
  verifyToken,
  validateChangePassword,
  authController.changePassword
);
router.post(
  "/forgot-password",
  validateForgotPassword,
  authController.forgotPassword
);
router.put(
  "/reset-password",
  validateResetPassword,
  authController.resetPassword
);

module.exports = router;
