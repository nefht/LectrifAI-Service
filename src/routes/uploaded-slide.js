const express = require("express");
const router = express.Router();
const uploadedSlideController = require("../app/controllers/UploadedSlideController");
const {
  upload,
  uploadToS3,
} = require("../app/middleware/multerMiddleware");
const { verifyToken } = require("../app/middleware/authMiddleware");
const { convertFileToPdfMiddleware } = require("../app/middleware/uploadedSlideMiddleware");

router.get("/:id", verifyToken, uploadedSlideController.getUploadedSlideById);
router.get("/download/:id", verifyToken, uploadedSlideController.downloadSlide);
router.post(
  "/",
  verifyToken,
  upload.single("file"),
  convertFileToPdfMiddleware,
  uploadToS3("uploaded-slides"),
  uploadedSlideController.uploadSlide
);
router.get("/", verifyToken, uploadedSlideController.getUploadedSlides);

module.exports = router;
