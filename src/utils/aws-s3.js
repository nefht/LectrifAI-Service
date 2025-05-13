const multer = require("multer");
const axios = require("axios");
const { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { v4: uuidv4 } = require("uuid");
const { s3Client } = require("../config/aws-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const uploadToS3AndGetUrl = async (file, folder) => {
  const fileExtension = file.originalname.split(".").pop();
  const uniqueFileName = `${uuidv4()}.${fileExtension}`;

  const command = new PutObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: `${folder}/${uniqueFileName}`,
    Body: file.buffer,
    ContentType: file.mimetype,
  });

  await s3Client.send(command);

  return `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${folder}/${uniqueFileName}`;
};

/**
 * Tải file từ AWS S3 về bộ nhớ server.
 * @param {string} fileUrl - URL của file trên S3.
 * @returns {Buffer} - Dữ liệu file dưới dạng buffer.
 */
const downloadFileFromS3 = async (fileUrl) => {
  try {
    let s3Key = fileUrl;

    if (fileUrl.startsWith("http")) {
      const urlParts = new URL(fileUrl);
      s3Key = urlParts.pathname.substring(1);
    }

    if (!s3Key) {
      throw new Error("Invalid S3 file key.");
    }

    const command = new GetObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: s3Key,
    });

    const presignedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 600,
    });

    const response = await axios.get(presignedUrl, {
      responseType: "arraybuffer",
    });

    return response.data;
  } catch (error) {
    throw new Error("Failed to download file from S3: " + error.message);
  }
};

/**
 * Tải presigned URL của file từ AWS S3.
 * @param {string} fileUrl - URL của file trên S3.
 * @param {number} expiresIn - Thời gian hết hạn của link (giây).
 * @returns {string} - Presigned URL của file.
 */

const getPresignedDownloadUrl = async (fileUrl, expiresIn = 3600) => {
  try {
    let s3Key = extractS3Key(fileUrl);

    const command = new GetObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: s3Key,
    });

    return await getSignedUrl(s3Client, command, { expiresIn });
  } catch (error) {
    throw new Error("Failed to generate presigned URL: " + error.message);
  }
};

/**
 * Xóa file từ AWS S3.
 * @param {string} fileUrl - URL của file trên S3.
 * @returns {Promise<void>} - Promise khi xóa thành công.
 */
const deleteFileFromS3 = async (fileUrl) => {
  try {
    const s3Key = extractS3Key(fileUrl);

    const command = new DeleteObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: s3Key,
    });

    await s3Client.send(command);
  } catch (error) {
    throw new Error("Failed to delete file from S3: " + error.message);
  }
}

/**
 * Trích xuất S3 key từ URL file.
 * @param {string} fileUrl - URL đầy đủ của file trên S3.
 * @returns {string} - S3 Key (đường dẫn bên trong S3).
 */
const extractS3Key = (fileUrl) => {
  if (fileUrl.startsWith("http")) {
    const urlParts = new URL(fileUrl);
    return urlParts.pathname.substring(1);
  }
  return fileUrl;
};

module.exports = {
  uploadToS3AndGetUrl,
  downloadFileFromS3,
  getPresignedDownloadUrl,
  deleteFileFromS3,
};
