// Sử dụng Object.freeze tạo enum đảm bảo tính bất biến
const EUploadedSlide = Object.freeze({
  FILE_NAME: "fileName",
  FILE_SIZE: "fileSize",
  FILE_URL: "fileUrl",
  LECTURE_ID: "lectureId",
});

module.exports = { EUploadedSlide };
