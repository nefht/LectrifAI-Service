const poppler = require("pdf-poppler");
const { Poppler } = require("node-poppler");
const fs = require("fs/promises");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const os = require("os");

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

    if (os.platform() === "linux") {
      const nodePoppler = new Poppler();
      // Cấu hình chuyển đổi PDF -> PNG
      const options = {
        allFiles: true,
        pngFile: true,
      };

      // Chuyển đổi PDF thành danh sách ảnh PNG
      await nodePoppler.pdfImages(pdfPath, imageDir, options);
    } else {
      // Cấu hình chuyển đổi PDF -> PNG
      const options = {
        format: "png",
        out_dir: imageDir,
        out_prefix: "slide",
        resolution: 600, // DPI cao để ảnh sắc nét
      };

      // Chuyển đổi PDF thành danh sách ảnh PNG
      await poppler.convert(pdfPath, options);
    }

    // Lấy danh sách ảnh đã chuyển đổi
    const imageFiles = await fs.readdir(imageDir);
    console.log(`📸 Đã chuyển đổi PDF thành ${imageFiles.length} ảnh.`);

    // Đọc tất cả ảnh vào buffer
    const imageBuffers = await Promise.all(
      imageFiles.map(async (file) => {
        const imagePath = path.join(imageDir, file);
        const imageBuffer = await fs.readFile(imagePath);
        return imageBuffer;
      })
    );
    console.log(`📸 Đã đọc ${imageBuffers.length} ảnh vào buffer.`);

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
