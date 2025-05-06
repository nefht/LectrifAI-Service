const express = require("express");
const router = express.Router();

const ClassroomQuizController = require("../../app/controllers/Classroom/ClassroomQuizController");
const { verifyToken } = require("../../app/middleware/authMiddleware");
const { validateUpdateClassroomQuiz } = require("../../app/middleware/classroom/classroomQuizMiddleware");

router.get("/:id", verifyToken, ClassroomQuizController.getClassroomQuizById);
router.delete(
  "/:id",
  verifyToken,
  ClassroomQuizController.deleteClassroomQuizById
);
router.put(
  "/:id",
  verifyToken,
  validateUpdateClassroomQuiz,
  ClassroomQuizController.updateClassroomQuizById
);

module.exports = router;
