const express = require("express");
const router = express.Router();
const notebookController = require("../app/controllers/NotebookController");
const { verifyToken } = require("../app/middleware/authMiddleware");
const {
  validateUpdateNotebook,
} = require("../app/middleware/notebookMiddleware");

router.get(
  "/:lectureId",
  verifyToken,
  notebookController.getNotebookByLectureId
);
router.get("/", verifyToken, notebookController.getNotebooks);
router.post("/", verifyToken, notebookController.createOrGetNotebook);
router.put(
  "/:lectureId",
  verifyToken,
  validateUpdateNotebook,
  notebookController.updateNotebook
);

module.exports = router;
