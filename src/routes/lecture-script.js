const express = require("express");
const router = express.Router();
const lectureScriptController = require("../app/controllers/LectureScriptController");
const { verifyToken } = require("../app/middleware/authMiddleware");
const {
  validateLectureScript,
  validateUpdateLectureScript,
} = require("../app/middleware/lectureScriptMiddleware");

router.get("/", verifyToken, lectureScriptController.getLectureScripts);
router.get("/:id", verifyToken, lectureScriptController.getLectureScriptById);
router.post(
  "/",
  verifyToken,
  validateLectureScript,
  lectureScriptController.createLectureScript
);
router.patch(
  "/edit-quiz/:id",
  verifyToken,
  validateUpdateLectureScript,
  lectureScriptController.updateLectureScript
);
router.patch(
  "/:id",
  verifyToken,
  validateUpdateLectureScript,
  lectureScriptController.updateLectureScript
);

module.exports = router;
