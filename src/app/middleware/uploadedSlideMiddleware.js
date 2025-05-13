const Joi = require("joi");
const path = require("path");
const fs = require("fs/promises");
const { v4: uuidv4 } = require("uuid");
const { convertToPdf } = require("../../utils/libre-office");
const { PDFDocument } = require("pdf-lib");

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

    // Check PDF's number of pages
    const pageCount = await getPdfPageCount(pdfBuffer);
    if (pageCount > 40) {
      return res.status(400).json({
        error: "The PDF file exceeds the maximum page limit of 40 pages.",
      });
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

/**
 * Count PDF's number of pages (Used before generating lecture script)
 * @param {Buffer} pdfBuffer - PDF file buffer
 * @returns {Promise<number>} - Number of pages in the PDF
 */
const getPdfPageCount = async (pdfBuffer) => {
  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    return pdfDoc.getPages().length;
  } catch (error) {
    throw new Error("Failed to read PDF: " + error.message);
  }
};

module.exports = { convertFileToPdfMiddleware };
