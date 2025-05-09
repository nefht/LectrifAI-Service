const express = require("express");
const router = express.Router();
const LectureVideoController = require("../app/controllers/LectureVideoController");
const { verifyToken } = require("../app/middleware/authMiddleware");
const {
  validateCreateLectureVideo,
  validateUpdateLectureVideo,
  validateShareLectureVideo,
} = require("../app/middleware/lectureVideoMiddleware");

router.post(
  "/share/:id",
  verifyToken,
  validateShareLectureVideo,
  LectureVideoController.shareLectureVideo
);
router.get(
  "/share/:id",
  verifyToken,
  LectureVideoController.getLectureVideoPermissions
);

router.get("/user/:userId", verifyToken, LectureVideoController.getLectureVideosByUserId);
router.get("/:id", verifyToken, LectureVideoController.getLectureVideoById);
router.delete("/:id", verifyToken, LectureVideoController.deleteLectureVideo);
router.put(
  "/:id",
  verifyToken,
  validateUpdateLectureVideo,
  LectureVideoController.updateLectureVideo
);
router.patch(
  "/:id",
  verifyToken,
  validateUpdateLectureVideo,
  LectureVideoController.renameLectureVideo
);
router.post(
  "/",
  verifyToken,
  validateCreateLectureVideo,
  LectureVideoController.createLectureVideo
);
router.get("/", verifyToken, LectureVideoController.getLectureVideos);

module.exports = router;
