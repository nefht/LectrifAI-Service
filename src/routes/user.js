const express = require("express");
const router = express.Router();

const userController = require("../app/controllers/UserController");
const { verifyToken } = require("../app/middleware/authMiddleware");

router.get("/:id", verifyToken, userController.getUserById);
router.get("/", verifyToken, userController.getAllUsers);
router.put("/:id", verifyToken, userController.updateUser);
router.delete("/:id", verifyToken, userController.softDeleteUser);
router.patch(":id/restore", verifyToken, userController.restoreUser);
router.delete(
  "/:id/permanent",
  verifyToken,
  userController.permanentlyDeleteUser
);

module.exports = router;
