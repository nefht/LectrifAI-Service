const Joi = require("joi");
const { EUploadedSlide } = require("../constants/uploaded-slide");
const path = require("path");
const fs = require("fs/promises");
const { v4: uuidv4 } = require("uuid");
const { convertToPdf } = require("../../utils/libre-office");

const convertFileToPdfMiddleware = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    const { originalname, mimetype, buffer } = req.file;
    const fileExtension = path.extname(originalname).toLowerCase().substring(1);

    let pdfBuffer = buffer; // Giữ nguyên nếu đã là PDF

    // Nếu không phải PDF, tiến hành chuyển đổi
    if (mimetype !== "application/pdf") {
      console.log(`Converting ${originalname} to PDF...`);
      pdfBuffer = await convertToPdf(buffer, fileExtension);
    }

    // Tạo thư mục tạm
    const tempDir = path.join(__dirname, "../temp");
    await fs.mkdir(tempDir, { recursive: true });

    // Lưu file PDF vào bộ nhớ tạm
    const pdfFilePath = path.join(tempDir, `${uuidv4()}.pdf`);
    await fs.writeFile(pdfFilePath, pdfBuffer);

    // Gán lại thông tin file vào `req.file`
    req.file = {
      originalname: originalname.replace(/\.[^/.]+$/, ".pdf"), // Đổi đuôi thành .pdf
      mimetype: "application/pdf",
      buffer: pdfBuffer,
      size: pdfBuffer.length,
      path: pdfFilePath,
    };

    next();
  } catch (error) {
    console.error("Error converting file to PDF:", error);
    res.status(500).json({ error: "Failed to process file." });
  }
};

module.exports = { convertFileToPdfMiddleware };
