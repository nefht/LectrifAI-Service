const { customsearch } = require("@googleapis/customsearch");
const axios = require("axios");
const sharp = require("sharp");

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID;

async function searchImage(query) {
  const customSearch = customsearch("v1");

  try {
    const response = await customSearch.cse.list({
      auth: GOOGLE_API_KEY,
      cx: GOOGLE_CSE_ID,
      q: query,
      searchType: "image",
      num: 1,
    });

    const image = response.data.items[0];

    if (response.data.items && response.data.items.length > 0) {
      return {
        title: image.title,
        imageUrl: image.link,
      };
    }
  } catch (error) {
    console.error("Error searching for image:", error.message);
  }

  return null;
}

// async function isImageValid(imageUrl) {
//   try {
//     const response = await axios.head(imageUrl);
//     return (
//       response.status === 200 &&
//       response.headers["content-type"].startsWith("image/")
//     );
//   } catch (error) {
//     console.error("Error validating image URL:", error.message);
//     return false;
//   }
// }

async function isImageValid(imageUrl) {
  try {
    // Gửi yêu cầu GET để lấy ảnh
    const response = await axios.get(imageUrl, {
      responseType: "arraybuffer", // Đảm bảo nhận dữ liệu dưới dạng binary
    });

    // Kiểm tra header để xác định liệu đó có phải là ảnh hay không
    if (
      response.status === 200 &&
      response.headers["content-type"].startsWith("image/")
    ) {
      // Dùng sharp để lấy thông tin về kích thước ảnh (width, height)
      const imageBuffer = Buffer.from(response.data);
      const metadata = await sharp(imageBuffer).metadata();

      // Trả về chiều rộng, chiều cao và true nếu ảnh hợp lệ
      return {
        valid: true,
        width: metadata.width,
        height: metadata.height,
      };
    } else {
      return { valid: false };
    }
  } catch (error) {
    console.error("Error validating image URL:", error.message);
    return { valid: false };
  }
}

module.exports = { searchImage, isImageValid };
