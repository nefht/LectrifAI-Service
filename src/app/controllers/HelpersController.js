const axios = require("axios");
const textToSpeech = require("@google-cloud/text-to-speech");
const User = require("../models/User");
const LectureVideo = require("../models/LectureVideo");
const Quiz = require("../models/Quiz");
const SlideContent = require("../models/SlideContent");

class HelpersController {
  async getAllLanguagesList(req, res, next) {
    try {
      const response = await axios.get("https://restcountries.com/v3.1/all");

      // Lấy danh sách các ngôn ngữ từ API
      const languages = response.data.flatMap((country) =>
        country.languages ? Object.entries(country.languages) : []
      );

      // Chuyển danh sách thành đối tượng với tên ngôn ngữ và mã ngôn ngữ
      const uniqueLanguages = Array.from(
        new Map(
          languages.map(([code, name]) => [code, { code, name }])
        ).values()
      );

      // Sắp xếp theo tên ngôn ngữ theo tiếng Anh
      uniqueLanguages.sort((a, b) => a.name.localeCompare(b.name));

      console.log(uniqueLanguages); // Log danh sách ngôn ngữ đã sắp xếp
      res.status(200).json(uniqueLanguages);
    } catch (error) {
      next(error);
    }
  }

  async getTextToSpeechVoiceList(req, res, next) {
    try {
      const client = new textToSpeech.TextToSpeechClient();

      const voiceList = await client.listVoices();
      res.status(200).json(voiceList[0].voices);
    } catch (error) {
      next(error);
    }
  }

  async searchByCategory(req, res, next) {
    try {
      const userId = req.user.id;
      const { category, query } = req.query;

      if (!query) {
           return res.status(400).json({ message: 'Search query is required' });
      }

      let results = [];

      // Tạo biểu thức chính quy từ chuỗi tìm kiếm - "i" không phân biệt hoa thường
       const searchPattern = new RegExp(query, "i");
       switch (category) {
         case "all":
           // Search users
           const users = await User.find({
             $or: [
              //  { fullName: searchPattern },
               { email: searchPattern },
               { account: searchPattern },
             ],
           }).select("fullName email account avatarUrl");

           // Search lecture videos (user's own or public)
           const lectureVideos = await LectureVideo.find({
             $and: [
               { lectureName: searchPattern },
               { $or: [{ userId }, { isPublic: true }] },
             ],
           }).populate("userId", "fullName avatarUrl");

           // Search quizzes (user's own or public)
           const quizzes = await Quiz.find({
             $and: [
               { quizName: searchPattern },
               { $or: [{ userId }, { isPublic: true }] },
             ],
           }).populate("userId", "fullName avatarUrl");

           // Search slide contents (only user's own)
           const slideContents = await SlideContent.find({
             userId,
             name: searchPattern,
           }).populate("userId", "fullName avatarUrl");

           results = {
             users,
             lectureVideos,
             quizzes,
             slideContents,
           };
           break;

         case "users":
           results = await User.find({
             $or: [
               { fullName: searchPattern },
               { email: searchPattern },
               { account: searchPattern },
             ],
           }).select("fullName email account avatarUrl");
           break;

         case "slides":
           results = await SlideContent.find({
             userId,
             name: searchPattern,
           }).populate("userId", "fullName avatarUrl");
           break;

         case "lectures":
           results = await LectureVideo.find({
             $and: [
               { lectureName: searchPattern },
               { $or: [{ userId }, { isPublic: true }] },
             ],
           }).populate("userId", "fullName avatarUrl");
           break;

         case "quizzes":
           results = await Quiz.find({
             $and: [
               { quizName: searchPattern },
               { $or: [{ userId }, { isPublic: true }] },
             ],
           }).populate("userId", "fullName avatarUrl");
           break;

         default:
           return res.status(400).json({ message: "Invalid category" });
       }

       res.json(results);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new HelpersController();
