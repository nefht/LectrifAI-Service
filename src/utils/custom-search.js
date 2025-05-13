const { customsearch } = require("@googleapis/customsearch");
const axios = require("axios");

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
    console.log("Image found:", image);

    if (response.data.items && response.data.items.length > 0) {
      return {
        title: image.title,
        imageUrl: image.link,
        source: image.image.contextLink,
        width: image.image.width,
        height: image.image.height,
      };
    }
  } catch (error) {
    console.error("Error searching for image:", error.message);
  }

  return null;
}

async function isImageValid(imageUrl) {
  try {
    const response = await axios.head(imageUrl);
    return (
      response.status === 200 &&
      response.headers["content-type"].startsWith("image/")
    );
  } catch (error) {
    console.error("Error validating image URL:", error.message);
    return false;
  }
}

module.exports = { searchImage, isImageValid };
