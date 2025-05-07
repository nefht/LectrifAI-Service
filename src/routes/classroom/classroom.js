const express = require("express");
const router = express.Router();

const ClassroomController = require("../../app/controllers/Classroom/ClassroomController");
const { verifyToken } = require("../../app/middleware/authMiddleware");
const {
  validateRemoveStudentsFromClassroom,
  validateAddStudentsToClassroom,
  validateAddQuizzesToClassroom,
  validateAddLecturesToClassroom,
  validateCreateClassroom,
  validateRenameClassroom,
} = require("../../app/middleware/classroom/classroomMiddleware");

router.get(
  "/join/:inviteToken",
  verifyToken,
  ClassroomController.joinClassroomByInvite
);
router.get(
  "/materials/:id",
  verifyToken,
  ClassroomController.getClassroomMaterials
);
router.get("/added", verifyToken, ClassroomController.getAddedClassrooms);
router.get(
  "/students/:id",
  verifyToken,
  ClassroomController.getStudentsInClassroom
);
router.get(
  "/invite/:inviteToken",
  verifyToken,
  ClassroomController.getClassroomByInviteToken
);
router.get("/:id", verifyToken, ClassroomController.getClassroomById);
router.get("/", verifyToken, ClassroomController.getAllClassrooms);
router.put(
  "/reset-invite/:id",
  verifyToken,
  ClassroomController.resetInviteToken
);
router.put(
  "/remove-students/:id",
  verifyToken,
  validateRemoveStudentsFromClassroom,
  ClassroomController.removeStudentFromClassroom
);
router.put(
  "/students/:id",
  verifyToken,
  validateAddStudentsToClassroom,
  ClassroomController.addStudentsToClassroom
);
router.post(
  "/quizzes/:id",
  verifyToken,
  validateAddQuizzesToClassroom,
  ClassroomController.addQuizzesToClassroom
);
router.post(
  "/lectures/:id",
  verifyToken,
  validateAddLecturesToClassroom,
  ClassroomController.addLecturesToClassroom
);
router.post(
  "/",
  verifyToken,
  validateCreateClassroom,
  ClassroomController.createClassroom
);
router.patch(
  "/:id",
  verifyToken,
  validateRenameClassroom,
  ClassroomController.renameClassroom
);

module.exports = router;
