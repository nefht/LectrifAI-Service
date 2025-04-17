const express = require("express");
const router = express.Router();

const ClassroomLectureVideoController = require("../../app/controllers/Classroom/ClassroomLectureVideoController");
const { verifyToken } = require("../../app/middleware/authMiddleware");

router.get(
  "/:id",
  verifyToken,
  ClassroomLectureVideoController.getClassroomLectureVideoById
);

module.exports = router;
