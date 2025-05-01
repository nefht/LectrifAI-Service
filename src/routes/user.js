const express = require("express");
const router = express.Router();

const userController = require("../app/controllers/UserController");
const { verifyToken } = require("../app/middleware/authMiddleware");
const { upload, uploadToS3 } = require("../app/middleware/multerMiddleware");

router.post(
  "/avatar",
  verifyToken,
  upload.single("file"),
  uploadToS3("avatar"),
  userController.uploadAvater
);
router.put("/profile", verifyToken, userController.updateUserProfile)
router.get("/profile/:userId", verifyToken, userController.getUserProfile);
router.get("/:id", verifyToken, userController.getUserById);
router.get("/", verifyToken, userController.getAllUsers);
router.put("/", verifyToken, userController.updateUser);
router.delete("/:id", verifyToken, userController.softDeleteUser);
router.patch(":id/restore", verifyToken, userController.restoreUser);
router.delete(
  "/:id/permanent",
  verifyToken,
  userController.permanentlyDeleteUser
);

module.exports = router;
