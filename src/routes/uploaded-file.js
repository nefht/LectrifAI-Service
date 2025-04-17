const express = require("express");
const router = express.Router();
const uploadedFileController = require("../app/controllers/UploadedFileController");
const { verifyToken } = require("../app/middleware/authMiddleware");
const { upload, uploadToS3 } = require("../app/middleware/multerMiddleware");

router.post(
  "/",
  verifyToken,
  upload.single("file"),
  uploadToS3("uploaded-files"),
  uploadedFileController.uploadFile
);

router.get("/download/:id", verifyToken, uploadedFileController.downloadFile);

module.exports = router;
