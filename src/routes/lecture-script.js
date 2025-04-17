const express = require("express");
const router = express.Router();
const lectureScriptController = require("../app/controllers/LectureScriptController");
const { verifyToken } = require("../app/middleware/authMiddleware");
const {
  validateLectureScript,
} = require("../app/middleware/lectureScriptMiddleware");

router.get("/", verifyToken, lectureScriptController.getLectureScripts);
router.get("/:id", verifyToken, lectureScriptController.getLectureScriptById);
router.post(
  "/",
  verifyToken,
  validateLectureScript,
  lectureScriptController.createLectureScript
);
router.patch("/:id", verifyToken, lectureScriptController.updateLectureScript);

module.exports = router;
