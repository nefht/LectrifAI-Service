const express = require("express");
const router = express.Router();

const ClassroomQuizController = require("../../app/controllers/Classroom/ClassroomQuizController");
const { verifyToken } = require("../../app/middleware/authMiddleware");

router.get("/:id", verifyToken, ClassroomQuizController.getClassroomQuizById);
router.delete(
  "/:id",
  verifyToken,
  ClassroomQuizController.deleteClassroomQuizById
);
router.put(
  "/:id",
  verifyToken,
  ClassroomQuizController.updateClassroomQuizById
);

module.exports = router;
