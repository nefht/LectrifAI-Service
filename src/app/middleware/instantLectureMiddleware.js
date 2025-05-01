const Joi = require("joi");
const { uploadToS3AndGetUrl } = require("../../utils/aws-s3");

const uploadImageToS3 = (storageFolder) => async (req, res, next) => {
  if (!req.file && !req.body.message) {
    return res.status(400).json({
      error: "Missing required fields: either message or file is required.",
    });
  }

  if (req.file) {
    // Kiểm tra MIME type
    const validMimeTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/jpg",
    ];
    if (!validMimeTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        error: "File must be a valid image (JPEG, PNG, GIF)",
      });
    }

    // Kiểm tra kích thước (tối đa 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (req.file.size > maxSize) {
      return res.status(400).json({
        error: "File size must not exceed 10MB",
      });
    }

    try {
      const fileUrl = await uploadToS3AndGetUrl(req.file, storageFolder);
      req.file.location = fileUrl;
      next();
    } catch (error) {
      return res.status(500).json({ error: "Failed to upload file to S3" });
    }
  } else {
    next();
  }
};

// Schema Joi for create instant lecture
const createInstantLectureSchema = Joi.object({
  message: Joi.string().optional().allow(""),
  teachingStyle: Joi.string().required(),
  languageCode: Joi.string().required(),
  voiceType: Joi.string().required(),
}).unknown(true);

// Schema Joi for send message
const sendMessageSchema = Joi.object({
  message: Joi.string().optional().allow(""),
  teachingStyle: Joi.string().required(),
  languageCode: Joi.string().required(),
  voiceType: Joi.string().required(),
}).unknown(true);

// Schema Joi for update instant lecture
const updateInstantLectureSchema = Joi.object({
  lectureName: Joi.string().required(),
});

const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, {
    abortEarly: false,
  });

  if (error) {
    const errorMessages = error.details.map((err) => err.message);
    return res.status(400).json({ error: errorMessages });
  }
  next();
};

const validateCreateInstantLecture = validate(createInstantLectureSchema);
const validateSendMessage = validate(sendMessageSchema);
const validateUpdateInstantLecture = validate(updateInstantLectureSchema);

module.exports = {
  uploadImageToS3,
  validateCreateInstantLecture,
  validateSendMessage,
  validateUpdateInstantLecture,
};
