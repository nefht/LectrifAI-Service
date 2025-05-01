const express = require("express");
const router = express.Router();
const StudentAnswerController = require("../../app/controllers/Classroom/StudentAnswerController");
const { verifyToken } = require("../../app/middleware/authMiddleware");

router.get(
  "/status/:classroomQuizId",
  verifyToken,
  StudentAnswerController.getAnswerStatusByClassroomQuizId
);
router.get("/:id", verifyToken, StudentAnswerController.getStudentAnswerById);
router.post("/start-quiz", verifyToken, StudentAnswerController.startQuiz);
router.put("/:id", verifyToken, StudentAnswerController.updateStudentAnswer);
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
