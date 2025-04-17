const axios = require("axios");
const textToSpeech = require("@google-cloud/text-to-speech");

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
      // const response = await axios.get(
      //   "https://texttospeech.googleapis.com/v1/voices"
      // );

      // // Lấy danh sách giọng đọc từ API
      // const voices = response.data.voices;

      // // Sắp xếp theo tên giọng đọc theo tiếng Anh
      // voices.sort((a, b) => a.name.localeCompare(b.name));

      // console.log(voices); // Log danh sách giọng đọc đã sắp xếp
      res.status(200).json(voiceList[0].voices);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new HelpersController();
