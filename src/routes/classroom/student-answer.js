const express = require("express");
const router = express.Router();
const StudentAnswerController = require("../../app/controllers/Classroom/StudentAnswerController");
const { verifyToken } = require("../../app/middleware/authMiddleware");
const {
  validateStartQuiz,
  validateUpdateStudentAnswer,
} = require("../../app/middleware/classroom/studentAnswerMiddleware");

router.get(
  "/ranking/:classroomId",
  verifyToken,
  StudentAnswerController.getClassroomRanking
);
router.get(
  "/:classroomId/student/:studentId",
  verifyToken,
  StudentAnswerController.getStudentQuizDetails
);
router.get(
  "/status/:classroomQuizId",
  verifyToken,
  StudentAnswerController.getAnswerStatusByClassroomQuizId
);
router.get("/:id", verifyToken, StudentAnswerController.getStudentAnswerById);
router.post(
  "/start-quiz",
  verifyToken,
  validateStartQuiz,
  StudentAnswerController.startQuiz
);
router.put(
  "/:id",
  verifyToken,
  validateUpdateStudentAnswer,
  StudentAnswerController.updateStudentAnswer
);
router.post(
  "/submit/:id",
  verifyToken,
  StudentAnswerController.submitStudentAnswer
);
router.post(
  "/grade/:id",
  verifyToken,
  StudentAnswerController.gradeStudentAnswer
);

module.exports = router;
