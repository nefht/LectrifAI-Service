const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const UploadedFile = require("../models/UploadedFile");
const { getPresignedDownloadUrl } = require("../../utils/aws-s3");

class UploadedFileController {
  // [POST] /uploaded-file
  async uploadFile(req, res, next) {
    try {
      const userId = req.user.id;
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "No file uploaded." });
      }

      const decodedFileName = Buffer.from(file.originalname, "latin1").toString(
        "utf8"
      );

      const uploadedFile = new UploadedFile({
        userId,
        fileName: decodedFileName,
        fileSize: file.size,
        fileUrl: file.location,
      });

      await uploadedFile.save();
      res
        .status(201)
        .json({ message: "File uploaded successfully!", uploadedFile });
    } catch (error) {
      next(error);
    }
  }

  // [GET] /uploaded-file/download/:id
  async downloadFile(req, res, next) {
    try {
      const { id } = req.params;
      const uploadedFile = await UploadedFile.findById(id);
      if (!uploadedFile) {
        return res.status(404).json({ error: "File not found." });
      }

      const presignedUrl = await getPresignedDownloadUrl(uploadedFile.fileUrl);

      res.json({ fileUrl: presignedUrl });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new UploadedFileController();
