const axios = require("axios");
const { searchImage, isImageValid } = require("../../utils/custom-search");
const {
  generateSlideContentWithGoogleAIV1,
  generateSlideContentWithGoogleAIV2,
  generateSlideContentWithGoogleAIV3,
} = require("../../utils/google-ai");
const SlideContent = require("../models/SlideContent");
const UploadedFile = require("../models/UploadedFile");

class GeneratedSlideController {
  // [GET] /slide-content
  async getSlideContents(req, res, next) {
    try {
      const userId = req.user.id;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      const {
        search,
        language,
        writingTone,
        numberOfSlides,
        sortBy = "createdAt",
        order = "desc",
      } = req.query;

      // Tạo filter object
      const filter = { userId };
      if (language) filter.language = language;
      if (writingTone) filter.writingTone = writingTone;
      const numberFilter = req.query.numberOfSlides;
      if (typeof numberFilter === "object") {
        filter.numberOfSlides = {};
        if (numberFilter.gte && !isNaN(Number(numberFilter.gte))) {
          filter.numberOfSlides.$gte = Number(numberFilter.gte);
        }
        if (numberFilter.lte && !isNaN(Number(numberFilter.lte))) {
          filter.numberOfSlides.$lte = Number(numberFilter.lte);
        }
      } else if (numberFilter && !isNaN(Number(numberFilter))) {
        filter.numberOfSlides = Number(numberFilter);
      }
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: "i" } },
          { topicText: { $regex: search, $options: "i" } },
          { "slideData.title": { $regex: search, $options: "i" } },
          { "slideData.slides.heading": { $regex: search, $options: "i" } },
          {
            "slideData.slides.bulletPoints": {
              $elemMatch: { $regex: search, $options: "i" },
            },
          },
        ];
      }

      // Tạo sort object
      const sort = {};
      sort[sortBy] = order === "asc" ? 1 : -1;

      const [total, slideContents] = await Promise.all([
        SlideContent.countDocuments(filter),
        SlideContent.find(filter).sort(sort).skip(skip).limit(limit),
      ]);

      return res.json({
        data: slideContents,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // [GET] /slide-content/:id
  async getSlideContentById(req, res, next) {
    const userId = req.user.id;
    const { id } = req.params;
    try {
      const slideContent = await SlideContent.findOne({
        _id: id,
        userId,
      }).populate("topicFileId");
      if (!slideContent) {
        return res.status(404).json({ error: "Slide content not found." });
      }
      res.json(slideContent);
    } catch (error) {
      next(error);
    }
  }

  // [PUT] /slide-content/:id
  async updateSlideContent(req, res, next) {
    const userId = req.user.id;
    const { id } = req.params;
    const { slideData } = req.body;
    try {
      const slideContent = await SlideContent.findOneAndUpdate(
        { _id: id, userId },
        { slideData },
        { new: true }
      );
      if (!slideContent) {
        return res.status(404).json({ error: "Slide content not found." });
      }
      res.json(slideContent);
    } catch (error) {
      next(error);
    }
  }

  // [GET] /slide-content/image-proxy
  async getImageProxy(req, res, next) {
    const imageUrl = req.query.url; // Lấy URL ảnh từ query string

    if (!imageUrl) {
      return res.status(400).send("Image URL is required");
    }

    try {
      // Gửi yêu cầu GET đến URL ảnh từ Google API
      const response = await axios.get(imageUrl, {
        responseType: "arraybuffer",
      });

      // Trả lại ảnh về frontend
      res.set("Content-Type", "image/jpeg"); // Hoặc "image/png" tùy vào loại ảnh
      res.send(response.data); // Trả về dữ liệu ảnh cho frontend
    } catch (error) {
      next(error);
    }
  }

  // [POST] /slide-content/v1 - Case 1: Topic Text/Document Text
  async createSlideContentV1(req, res, next) {
    const userId = req.user.id;
    const {
      topicText,
      writingTone,
      language,
      numberOfSlides,
      templateCode,
      specificRequirements,
    } = req.body;
    console.log("Request body:", req.body);

    try {
      const response = await generateSlideContentWithGoogleAIV1(
        topicText,
        writingTone,
        language,
        numberOfSlides,
        specificRequirements
      );
      console.log("Response from Google AI:", response);

      const rawText = response.candidates[0]?.content?.parts[0]?.text;
      if (!rawText) {
        throw new Error("No valid content returned from AI API.");
      }

      let presentationData;
      try {
        presentationData = JSON.parse(
          rawText.replace(/```json|```/g, "").trim()
        );
      } catch (err) {
        throw new Error("Error parsing JSON content: " + err.message);
      }

      console.log("Parsed presentation data:", presentationData);

      if (
        !presentationData ||
        !presentationData.slides ||
        presentationData.slides.length === 0
      ) {
        throw new Error("No slides generated from AI API response.");
      }

      for (let slide of presentationData.slides) {
        if (slide.imageSuggestions && slide.imageSuggestions.length > 0) {
          let imageUrls = [];

          for (let keyword of slide.imageSuggestions) {
            const imageUrl = await searchImage(keyword);
            if (imageUrl && (await isImageValid(imageUrl.imageUrl))) {
              const proxyUrl = `${
                process.env.SERVER_URL
              }/slide-content/image-proxy?url=${encodeURIComponent(
                imageUrl.imageUrl
              )}`;
              imageUrls.push({
                title: imageUrl.title,
                imageUrl: proxyUrl,
              });
            }
          }
          slide.imageUrls = imageUrls;
        }
      }

      const slideContent = new SlideContent({
        userId,
        name: presentationData.title,
        topicText,
        writingTone,
        language,
        numberOfSlides,
        templateCode,
        specificRequirements,
        slideData: presentationData,
      });
      await slideContent.save();
      res.json(slideContent);
    } catch (error) {
      next(error);
    }
  }

  // [POST] /slide-content/v2 - Case 2: File (docx, pptx, pdf)
  async createSlideContentV2(req, res, next) {
    const userId = req.user.id;
    const { topicFileId, writingTone, language, numberOfSlides, templateCode } =
      req.body;
    console.log("Request body:", req.body);

    const uploadedFile = await UploadedFile.findById(topicFileId);
    if (!uploadedFile) {
      return res.status(404).json({ error: "File not found." });
    }
    try {
      const response = await generateSlideContentWithGoogleAIV2(
        uploadedFile,
        writingTone,
        language,
        numberOfSlides
      );
      console.log("Response from Google AI:", response);

      const rawText = response.candidates[0]?.content?.parts[0]?.text;
      if (!rawText) {
        throw new Error("No valid content returned from AI API.");
      }

      let presentationData;
      try {
        presentationData = JSON.parse(
          rawText.replace(/```json|```/g, "").trim()
        );
      } catch (err) {
        throw new Error("Error parsing JSON content: " + err.message);
      }

      console.log("Parsed presentation data:", presentationData);

      if (
        !presentationData ||
        !presentationData.slides ||
        presentationData.slides.length === 0
      ) {
        throw new Error("No slides generated from AI API response.");
      }

      for (let slide of presentationData.slides) {
        if (slide.imageSuggestions && slide.imageSuggestions.length > 0) {
          let imageUrls = [];

          for (let keyword of slide.imageSuggestions) {
            const imageUrl = await searchImage(keyword);
            if (imageUrl && (await isImageValid(imageUrl.imageUrl))) {
              const proxyUrl = `${
                process.env.SERVER_URL
              }/slide-content/image-proxy?url=${encodeURIComponent(
                imageUrl.imageUrl
              )}`;
              imageUrls.push({
                title: imageUrl.title,
                imageUrl: proxyUrl,
              });
            }
          }
          slide.imageUrls = imageUrls;
        }
      }

      const slideContent = new SlideContent({
        userId,
        name: presentationData.title,
        topicFileId,
        writingTone,
        language,
        numberOfSlides,
        templateCode,
        slideData: presentationData,
      });
      await slideContent.save();
      res.json(slideContent);
    } catch (error) {
      next(error);
    }
  }

  // [POST] /slide-content/v3 - Case 3: Document text
  async createSlideContentV3(req, res, next) {
    const userId = req.user.id;
    const {
      topicParagraph,
      writingTone,
      language,
      numberOfSlides,
      templateCode,
    } = req.body;
    console.log("Request body:", req.body);

    try {
      const response = await generateSlideContentWithGoogleAIV3(
        topicParagraph,
        writingTone,
        language,
        numberOfSlides,
      );
      console.log("Response from Google AI:", response);

      const rawText = response.candidates[0]?.content?.parts[0]?.text;
      if (!rawText) {
        throw new Error("No valid content returned from AI API.");
      }

      let presentationData;
      try {
        presentationData = JSON.parse(
          rawText.replace(/```json|```/g, "").trim()
        );
      } catch (err) {
        throw new Error("Error parsing JSON content: " + err.message);
      }

      console.log("Parsed presentation data:", presentationData);

      if (
        !presentationData ||
        !presentationData.slides ||
        presentationData.slides.length === 0
      ) {
        throw new Error("No slides generated from AI API response.");
      }

      for (let slide of presentationData.slides) {
        if (slide.imageSuggestions && slide.imageSuggestions.length > 0) {
          let imageUrls = [];

          for (let keyword of slide.imageSuggestions) {
            const imageUrl = await searchImage(keyword);
            if (imageUrl && (await isImageValid(imageUrl.imageUrl))) {
              const proxyUrl = `${
                process.env.SERVER_URL
              }/slide-content/image-proxy?url=${encodeURIComponent(
                imageUrl.imageUrl
              )}`;
              imageUrls.push({
                title: imageUrl.title,
                imageUrl: proxyUrl,
              });
            }
          }
          slide.imageUrls = imageUrls;
        }
      }

      const slideContent = new SlideContent({
        userId,
        name: presentationData.title,
        topicParagraph,
        writingTone,
        language,
        numberOfSlides,
        templateCode,
        slideData: presentationData,
      });
      await slideContent.save();
      res.json(slideContent);
    } catch (error) {
      next(error);
    }
  }

  // [PATCH] /slide-content/:id
  async updateSlideContent(req, res, next) {
    const userId = req.user.id;
    const { id } = req.params;
    const { slideData } = req.body;
    try {
      const slideContent = await SlideContent.findOneAndUpdate(
        { _id: id, userId },
        { slideData },
        { new: true }
      );
      if (!slideContent) {
        return res.status(404).json({ error: "Slide content not found." });
      }
      res.json(slideContent);
    } catch (error) {
      next(error);
    }
  }

  // [DELETE] /slide-content/:id
  async deleteSlideContent(req, res, next) {
    const userId = req.user.id;
    const { id } = req.params;
    try {
      const slideContent = await SlideContent.findOneAndDelete({
        _id: id,
        userId,
      });
      if (!slideContent) {
        return res.status(404).json({ error: "Slide content not found." });
      }
      res.json({ message: "Slide content deleted successfully." });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new GeneratedSlideController();
