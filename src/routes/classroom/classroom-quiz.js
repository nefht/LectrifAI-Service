const express = require("express");
const router = express.Router();

const ClassroomQuizController = require("../../app/controllers/Classroom/ClassroomQuizController");
const { verifyToken } = require("../../app/middleware/authMiddleware");

router.get("/:id", verifyToken, ClassroomQuizController.getClassroomQuizById);

module.exports = router;
