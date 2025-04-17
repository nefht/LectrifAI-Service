const express = require("express");
const router = express.Router();

const ClassroomController = require("../../app/controllers/Classroom/ClassroomController");
const { verifyToken } = require("../../app/middleware/authMiddleware");

router.get("/materials/:id", verifyToken, ClassroomController.getClassroomMaterials);
router.get("/added", verifyToken, ClassroomController.getAddedClassrooms);
router.get("/students/:id", verifyToken, ClassroomController.getStudentsInClassroom);
router.get("/:id", verifyToken, ClassroomController.getClassroomById);
router.get("/", verifyToken, ClassroomController.getAllClassrooms);
router.put("/students/:id", verifyToken, ClassroomController.addStudentsToClassroom);
router.post("/quizzes/:id", verifyToken, ClassroomController.addQuizzesToClassroom);
router.post("/lectures/:id", verifyToken, ClassroomController.addLecturesToClassroom);
router.post("/", verifyToken, ClassroomController.createClassroom);

module.exports = router;