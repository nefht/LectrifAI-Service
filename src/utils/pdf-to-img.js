const { promises: fs } = require("fs");
const { pdf } = require("pdf-to-img");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

/**
 * Chuyển đổi PDF thành ảnh (không lưu file)
 * @param {Buffer} pdfBuffer - File PDF dưới dạng buffer
 * @returns {Promise<Array<Buffer>>} - Danh sách các ảnh dưới dạng buffer
 */
const convertPdfToImages = async (pdfBuffer) => {
  try {
    // Tạo thư mục tạm để lưu file PDF
    const tempDir = path.join(__dirname, "../temp");
    await fs.mkdir(tempDir, { recursive: true });

    // Ghi buffer PDF vào file tạm
    const pdfPath = path.join(tempDir, `${uuidv4()}.pdf`);
    await fs.writeFile(pdfPath, pdfBuffer);

    console.log(`📄 Đã lưu file PDF tạm: ${pdfPath}`);

    // Tạo thư mục lưu ảnh tạm thời
    const imageDir = path.join(tempDir, uuidv4());
    await fs.mkdir(imageDir, { recursive: true });

    // Sử dụng pdf-to-img để chuyển đổi PDF thành ảnh
    const document = await pdf(pdfPath, { scale: 1 });

    let counter = 1;
    const imageBuffers = [];
    for await (const image of document) {
      const imagePath = path.join(imageDir, `page${counter}.png`);
      await fs.writeFile(imagePath, image);
      imageBuffers.push(await fs.readFile(imagePath));
      counter++;
    }
    console.log(`📸 Đã chuyển đổi PDF thành ${imageBuffers.length} ảnh.`);

    // Xóa file PDF tạm và thư mục ảnh tạm
    await fs.unlink(pdfPath);
    await fs.rm(imageDir, { recursive: true, force: true });
    console.log("🧹 Đã xóa file PDF và thư mục ảnh tạm.");

    return imageBuffers; // Trả về danh sách buffer ảnh
  } catch (error) {
    throw new Error("Failed to convert PDF to images: " + error.message);
  }
};

module.exports = { convertPdfToImages };