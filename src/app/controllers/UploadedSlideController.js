const path = require("path");
const UploadedSlide = require("../models/UploadedSlide");
const { EUploadedSlide } = require("../constants/uploaded-slide");
const {
  getPresignedDownloadUrl,
  downloadFileFromS3,
} = require("../../utils/aws-s3");

class UploadedSlideController {
  // [GET] /uploaded-slide
  async getUploadedSlides(req, res, next) {
    try {
      const userId = req.user.id; // Lấy userId từ token
      const slides = await UploadedSlide.find({ userId: userId }).sort({
        createdAt: -1,
      }); // Sắp xếp theo thời gian mới nhất
      res.status(200).json(slides);
    } catch (error) {
      next(error);
    }
  }

  // [GET] /uploaded-slide/:id
  async getUploadedSlideById(req, res, next) {
    try {
      const userId = req.user.id;
      const slide = await UploadedSlide.findById(req.params.id);
      if (!slide) {
        return res.status(404).json({ error: "Slide not found." });
      }

      // if (slide.userId.toString() !== userId) {
      //   return res.status(403).json({ error: "Access denied" });
      // }

      res.status(200).json(slide);
    } catch (error) {
      next(error);
    }
  }

  // [GET] /uploaded-slide/download/:id
  async downloadSlide(req, res, next) {
    try {
      const userId = req.user.id;
      const slideId = req.params.id;
      const slide = await UploadedSlide.findById(slideId);

      if (!slide) {
        return res.status(404).json({ error: "Slide not found." });
      }

      // if (slide.userId.toString() !== userId) {
      //   return res.status(403).json({ error: "Access denied" });
      // }

      const file = await downloadFileFromS3(slide.fileUrl);

      // Cài đặt các header cho response để trình duyệt nhận diện là file tải về
      res.setHeader(
        "Access-Control-Expose-Headers", // Cho phép FE truy cập header từ response
        "Content-Disposition"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename*=${encodeURIComponent(slide.fileName)}`
      );
      res.setHeader("Content-Type", "application/octet-stream");

      // Trả file về cho frontend
      res.send(file);
    } catch (error) {
      next(error);
    }
  }

  // [POST] /uploaded-slide
  async uploadSlide(req, res, next) {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    try {
      const userId = req.user.id;
      const decodedFileName = Buffer.from(file.originalname, "latin1").toString(
        "utf8"
      );
      const slide = new UploadedSlide({
        userId,
        [EUploadedSlide.FILE_NAME]: decodedFileName,
        [EUploadedSlide.FILE_SIZE]: file.size,
        // [EUploadedSlide.FILE_URL]: `uploads/slides/${req.file.filename}`,
        [EUploadedSlide.FILE_URL]: file.location,
      });
      await slide.save();

      res.status(200).json({
        message: "File uploaded successfully!",
        file: slide,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new UploadedSlideController();
