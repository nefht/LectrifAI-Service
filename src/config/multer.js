const multer = require("multer");
const path = require("path");

// Cấu hình lưu trữ ảnh
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/images/");
  },
  filename: (req, file, cb) => {
    cb(null, `image-${Date.now()}${path.extname(file.originalname)}`);
  },
});

// Cấu hình lưu trữ slide
const slideStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/slides/");
  },
  filename: (req, file, cb) => {
    cb(null, `slide-${Date.now()}${path.extname(file.originalname)}`);
  },
});

module.exports = { imageStorage, slideStorage };
