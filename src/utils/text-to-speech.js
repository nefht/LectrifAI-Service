const textToSpeech = require("@google-cloud/text-to-speech");
const fs = require("fs-extra");
const path = require("path");

const client = new textToSpeech.TextToSpeechClient();

/**
 * Lấy giọng nói
 * @param {string} languageCode - Ngôn ngữ (ví dụ: "en-US", "vi-VN")
 * @param {string} ssmlGender - Giới tính (ví dụ: "FEMALE", "MALE")
 * @returns {string} voiceName - Tên giọng nói
 */
const getVoiceName = async (languageCode, ssmlGender) => {
  try {
    const response = await client.listVoices();
    const voices = response[0].voices;
    const filteredVoices = voices.filter(
      (voice) =>
        voice.languageCodes.includes(languageCode) &&
        voice.ssmlGender === ssmlGender &&
        (voice.name.includes("Wavenet") || voice.name.includes("Standard"))
    );

    // Ưu tiên giọng Wavenet
    const sortedVoices = filteredVoices.sort((a, b) => {
      if (a.name.includes("Wavenet") && !b.name.includes("Wavenet")) {
        return -1;
      }
      if (!a.name.includes("Wavenet") && b.name.includes("Wavenet")) {
        return 1;
      }
      return 0;
    });
    return sortedVoices[0].name;
  } catch (error) {
    throw new Error("Failed to get voice name: " + error.message);
  }
};

/**
 * Tạo file âm thanh từ văn bản (Google TTS)
 * @param {string} text - Nội dung cần chuyển thành giọng nói
 * @param {string} languageCode - Ngôn ngữ (ví dụ: "en-US", "vi-VN")
 * @param {string} ssmlGender - Giới tính (ví dụ: "FEMALE", "MALE")
 * @param {string} lectureSpeed - Tốc độ giọng nói (ví dụ: "0.8", "1.0", "1.2")
 * @returns {Promise<string>} - Đường dẫn file âm thanh đã tạo
 */
const generateSpeech = async (
  text,
  languageCode = "vi-VN",
  voiceName,
  speakingRate
) => {
  try {
    const tempDir = path.join(__dirname, "../temp");
    await fs.ensureDir(tempDir);

    const audioPath = path.join(tempDir, `speech-${Date.now()}.mp3`);

    const request = {
      input: { text },
      voice: { languageCode, name: voiceName },
      audioConfig: { audioEncoding: "MP3", speakingRate: speakingRate },
    };

    const [response] = await client.synthesizeSpeech(request);
    await fs.writeFile(audioPath, response.audioContent);

    return audioPath;
  } catch (error) {
    throw new Error("Failed to generate speech: " + error.message);
  }
};

module.exports = { getVoiceName, generateSpeech };
