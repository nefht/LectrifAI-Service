const express = require("express");
const router = express.Router();
const { verifyToken } = require("../app/middleware/authMiddleware");
const QuizController = require("../app/controllers/QuizController");
const {
  validateCreateQuiz,
  validateCheckShortAnswer,
  validateCreateQuizFromFile,
} = require("../app/middleware/quizMiddleware");
const { upload, uploadToS3 } = require("../app/middleware/multerMiddleware");

router.post("/share/:id", verifyToken, QuizController.shareQuiz);
router.get("/share/:id", verifyToken, QuizController.getQuizPermissions);
router.get(
  "/permission/:id",
  verifyToken,
  QuizController.getUserPermissionWithQuiz
);

router.get("/", verifyToken, QuizController.getQuizzes);
router.get("/:id", verifyToken, QuizController.getQuizById);
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
router.patch("/info/:id", verifyToken, QuizController.updateQuizInfo);
router.patch("/:id", verifyToken, QuizController.updateQuiz);
router.delete("/:id", verifyToken, QuizController.deleteQuiz);

module.exports = router;
