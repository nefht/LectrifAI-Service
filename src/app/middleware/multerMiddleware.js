const multer = require("multer");
const { imageStorage, slideStorage } = require("../../config/multer");
const { uploadToS3AndGetUrl } = require("../../utils/aws-s3");

// Danh sách MIME types hợp lệ
const IMAGE_MIME_TYPES = ["image/jpeg", "image/png"];
const SLIDE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // pptx
];

// Kiểm tra file hợp lệ
const checkFileType = (file, allowedTypes, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mimetype = file.mimetype;

  if (
    allowedTypes.includes(mimetype) &&
    /\.(jpg|jpeg|png|pptx|pdf)$/i.test(ext)
  ) {
    cb(null, true);
  } else {
    cb(
      new Error(`Invalid file type. Allowed types: ${allowedTypes.join(", ")}`)
    );
  }
};

// Middleware upload ảnh (Chỉ cho phép JPG, PNG)
const imageUpload = multer({
  storage: imageStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => checkFileType(file, IMAGE_MIME_TYPES, cb),
});

// Middleware upload slide (Chỉ cho phép JPG, PNG, PDF, PPTX)
const slideUpload = multer({
  storage: slideStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => checkFileType(file, SLIDE_MIME_TYPES, cb),
});

// Middleware xử lý lỗi từ Multer khi upload file lên local
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  } else if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
};

// Middleware Multer: Chỉ lưu file vào bộ nhớ, không lưu local
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

// Middleware upload file lên S3
const uploadToS3 = (storageFolder) => async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded." });
  }

  try {
    const fileUrl = await uploadToS3AndGetUrl(req.file, storageFolder);
    req.file.location = fileUrl;
    next();
  } catch (error) {
    return res.status(500).json({ error: "Failed to upload file to S3" });
  }
};

module.exports = {
  imageUpload,
  slideUpload,
  handleMulterError,
  upload,
  uploadToS3,
};
