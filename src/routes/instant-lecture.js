const express = require("express");
const router = express.Router();
const { verifyToken } = require("../app/middleware/authMiddleware");
const InstantLectureController = require("../app/controllers/InstantLectureController");
const { upload } = require("../app/middleware/multerMiddleware");
const {
  uploadImageToS3,
  validateCreateInstantLecture,
  validateSendMessage,
  validateUpdateInstantLecture,
} = require("../app/middleware/instantLectureMiddleware");

router.get("/search", verifyToken, InstantLectureController.searchInstantLecture);
router.get("/:id", verifyToken, InstantLectureController.getInstantLecture);
router.get("/", verifyToken, InstantLectureController.getAllInstantLectures);
router.post(
  "/:id",
  verifyToken,
  upload.single("file"),
  uploadImageToS3("instant-lectures"),
  validateSendMessage,
  InstantLectureController.sendMessage
);
router.post(
  "/",
  verifyToken,
  upload.single("file"),
  uploadImageToS3("instant-lectures"),
  validateCreateInstantLecture,
  InstantLectureController.createInstantLecture
);
router.put(
  "/:id",
  verifyToken,
  validateUpdateInstantLecture,
  InstantLectureController.updateInstantLecture
)
router.delete(
  "/:id",
  verifyToken,
  InstantLectureController.deleteInstantLecture
);

module.exports = router;
