const express = require("express");
const router = express.Router();
const { verifyToken } = require("../app/middleware/authMiddleware");
const QuizController = require("../app/controllers/QuizController");
const {
  validateCreateQuiz,
  validateCheckShortAnswer,
  validateCreateQuizFromFile,
  validateShareQuiz,
  validateUpdateQuizInfo,
  validateUpdateQuiz,
} = require("../app/middleware/quizMiddleware");
const { upload, uploadToS3 } = require("../app/middleware/multerMiddleware");

router.post(
  "/share/:id",
  verifyToken,
  validateShareQuiz,
  QuizController.shareQuiz
);
router.get("/multiple-play/:id", verifyToken, QuizController.getRoomInfo);
router.get("/share/:id", verifyToken, QuizController.getQuizPermissions);
router.get(
  "/permission/:id",
  verifyToken,
  QuizController.getUserPermissionWithQuiz
);

router.get(
  "/multiple-play/join/:token",
  verifyToken,
  QuizController.joinMultiplePlayRoom
);
router.get("/user/:userId", verifyToken, QuizController.getQuizzesByUserId);
router.get("/:id", verifyToken, QuizController.getQuizById);
router.get("/", verifyToken, QuizController.getQuizzes);
router.post(
  "/v1",
  verifyToken,
  validateCreateQuiz,
  QuizController.createQuizV1
);
router.post(
  "/v2",
  verifyToken,
  upload.single("file"),
  uploadToS3("uploaded-files"),
  validateCreateQuizFromFile,
  QuizController.createQuizV2
);
router.post(
  "/check-short-answer",
  verifyToken,
  validateCheckShortAnswer,
  QuizController.checkUserShortAnswer
);
router.post(
  "/multiple-play",
  verifyToken,
  QuizController.createMultiplePlayRoom
);
router.patch(
  "/info/:id",
  verifyToken,
  validateUpdateQuizInfo,
  QuizController.updateQuizInfo
);
router.patch(
  "/:id",
  verifyToken,
  validateUpdateQuiz,
  QuizController.updateQuiz
);
router.delete("/:id", verifyToken, QuizController.deleteQuiz);

module.exports = router;
