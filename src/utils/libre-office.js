
const { exec } = require("child_process");
const fs = require("fs/promises");
const path = require("path");
const sharp = require("sharp"); 
const { v4: uuidv4 } = require("uuid");

const convertPptxToPdf = async (pptxBuffer) => {
  try {
    const tempDir = path.join(__dirname, "../temp");
    await fs.mkdir(tempDir, { recursive: true });

    // Tạo file PPTX tạm thời trong bộ nhớ
    const pptxFilePath = path.join(tempDir, `${uuidv4()}.pptx`);
    const pdfFilePath = pptxFilePath.replace(".pptx", ".pdf");

    // Ghi file PPTX vào bộ nhớ
    await fs.writeFile(pptxFilePath, pptxBuffer);

    // Lệnh chuyển đổi pptx -> pdf bằng LibreOffice
    const command = `soffice --headless --convert-to pdf --outdir "${tempDir}" "${pptxFilePath}"`;

    // Chuyển đổi bằng LibreOffice
    await new Promise((resolve, reject) => {
      exec(command, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    // Đọc file PDF từ bộ nhớ vào buffer
    const pdfBuffer = await fs.readFile(pdfFilePath);

    // Xóa file tạm thời ngay sau khi dùng
    await fs.unlink(pptxFilePath);
    await fs.unlink(pdfFilePath);

    return pdfBuffer; // Trả về buffer PDF
  } catch (error) {
    throw new Error("Failed to convert PPTX to PDF: " + error.message);
  }
};

/**
 * Chuyển đổi file (PPTX, DOCX, DOC, PNG, JPG, ...) sang PDF
 * @param {Buffer} fileBuffer - Buffer chứa file đầu vào
 * @param {string} fileExtension - Định dạng file gốc (pptx, docx, doc, png, jpg, ...)
 * @returns {Buffer} - Buffer chứa file PDF
 */
const convertToPdf = async (fileBuffer, fileExtension) => {
  try {
    const tempDir = path.join(__dirname, "../temp");
    await fs.mkdir(tempDir, { recursive: true });

    // Xác định đường dẫn file tạm
    const inputFilePath = path.join(tempDir, `${uuidv4()}.${fileExtension}`);
    const pdfFilePath = inputFilePath.replace(`.${fileExtension}`, ".pdf");

    // Ghi file gốc vào bộ nhớ
    await fs.writeFile(inputFilePath, fileBuffer);

    // Nếu là file ảnh → Chuyển đổi bằng Sharp
    if (
      ["png", "jpg", "jpeg", "webp", "gif", "bmp"].includes(
        fileExtension.toLowerCase()
      )
    ) {
      await sharp(inputFilePath)
        .resize({
          width: 1240,
          height: 1754,
          fit: "contain",
          background: { r: 255, g: 255, b: 255 },
        }) // A4
        .toFormat("pdf")
        .toFile(pdfFilePath);
    } else {
      // Dùng LibreOffice để chuyển đổi các định dạng khác
      const command = `soffice --headless --convert-to pdf --outdir "${tempDir}" "${inputFilePath}"`;
      await new Promise((resolve, reject) => {
        exec(command, (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }

    // Đọc file PDF từ bộ nhớ vào buffer
    const pdfBuffer = await fs.readFile(pdfFilePath);

    // Xóa file tạm thời ngay sau khi dùng
    await fs.unlink(inputFilePath);
    await fs.unlink(pdfFilePath);

    return pdfBuffer; // Trả về buffer PDF
  } catch (error) {
    throw new Error(
      `Failed to convert ${fileExtension} to PDF: ${error.message}`
    );
  }
};

module.exports = { convertPptxToPdf, convertToPdf };
