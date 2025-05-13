const InstantLecture = require("../models/InstantLecture");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { TextToSpeechClient } = require("@google-cloud/text-to-speech");
const {
  GoogleGenAI,
  createUserContent,
  createPartFromUri,
} = require("@google/genai");
const fs = require("fs/promises");
const path = require("path");
const removeMd = require("remove-markdown");
const { getVoiceName } = require("../../utils/text-to-speech");
const { downloadFileFromS3 } = require("../../utils/aws-s3");
const { cleanMarkdown } = require("../../utils/helpers");

const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY);
const client = new TextToSpeechClient();

// Tạo cache cho nội dung chat gần đây
function buildRecentCacheContents(history, limit = 10) {
  const sliced = history.slice(-limit);
  return sliced.map((item) => ({
    role: item.role,
    parts: [{ text: item.text }],
  }));
}

class InstantLectureController {
  // [GET] /instant-lecture
  async getAllInstantLectures(req, res, next) {
    try {
      const userId = req.user.id;
      const instantLectures = await InstantLecture.find({ userId }).sort({
        createdAt: -1,
      });
      if (!instantLectures) {
        return res.status(200).json({ instantLectures: [] });
      }
      res.status(200).json(instantLectures);
    } catch (error) {
      next(error);
    }
  }

  // [GET] /instant-lecture/:id
  async getInstantLecture(req, res, next) {
    try {
      const { id } = req.params;

      const instantLecture = await InstantLecture.findById(id);
      if (!instantLecture) {
        return res.status(404).json({ error: "Instant lecture not found." });
      }

      res.status(200).json(instantLecture);
    } catch (error) {
      next(error);
    }
  }

  // [GET] /instant-lecture/search
  async searchInstantLecture(req, res, next) {
    try {
      const { keyword } = req.query;
      const userId = req.user.id;

      if (!keyword) {
        return res.status(400).json({ error: "Keyword is required." });
      }

      const instantLectures = await InstantLecture.find({
        userId,
        $or: [
          { lectureName: { $regex: keyword, $options: "i" } },
          { "history.text": { $regex: keyword, $options: "i" } },
        ],
      });

      if (!instantLectures) {
        return res.status(200).json({ instantLectures: [] });
      }

      res.status(200).json(instantLectures);
    } catch (error) {
      next(error);
    }
  }

  // [POST] /instant-lecture
  async createInstantLecture(req, res, next) {
    try {
      const userId = req.user.id;
      const { message, teachingStyle, languageCode, language, voiceType } =
        req.body;
      const imageUrl = req?.file?.location;
      if (!message && !imageUrl) {
        return res.status(400).json({ error: "Missing required fields." });
      }

      let lectureName = "New instant lecture";
      let image;
      if (imageUrl) {
        const uploadedImage = await downloadFileFromS3(imageUrl);

        const tempDir = path.join(__dirname, "../temp");
        await fs.mkdir(tempDir, { recursive: true });

        const imagePath = path.join(tempDir, `image-${Date.now()}.png`);
        await fs.writeFile(imagePath, uploadedImage);

        image = await genAI.files.upload({
          file: imagePath,
          config: { mimeType: "image/png" },
        });

        // Remove temporary image after uploading
        await fs
          .unlink(imagePath)
          .then(() => console.log("Temporary image file deleted."))
          .catch((err) =>
            console.error("Error deleting temporary image file:", err)
          );
      }

      let context = `
        You are a knowledgeable, patient, and engaging AI teacher. Your job is to assist the user by explaining content in a way that is clear, informative, and tailored to their needs. 
        Your teaching style is: "${teachingStyle}". You **MUST use the language "${language}" for all your responses**, regardless of what language the questioner uses..

        If the user uploads an image without any accompanying message, assume they want you to analyze and explain the content of the image as if you were giving a mini-lecture to a curious learner. 
        Start by identifying the subject of the image, then explain any key features, possible interpretations, and related concepts — all while keeping your explanation accessible and engaging.

        If the user provides a message (with or without an image), prioritize addressing their request. Use the teaching style "${teachingStyle}" to make your response helpful, concise, and easy to understand. 
        Include relevant examples or explanations where appropriate.

        Always ensure your tone remains warm, professional, and pedagogical — as if you are helping a student one-on-one.
      `;

      if (message) {
        context += `\n\nUser message: ${message}`;
      }

      // Tạo cuộc trò chuyện mới
      const instantLecture = new InstantLecture({
        userId,
        lectureName,
        teachingStyle,
        languageCode,
        voiceType,
        history: [{ role: "user", text: message, imageUrl: imageUrl ?? null }],
      });

      await instantLecture.save();

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const userContent = image
        ? [
            createUserContent([
              context ?? "",
              createPartFromUri(image.uri, image.mimeType),
            ]),
          ]
        : [createUserContent([context])];

      const response = await genAI.models.generateContentStream({
        model: "gemini-2.0-flash",
        contents: userContent,
        config: {
          systemInstruction: context,
        },
      });

      const voiceName = await getVoiceName(languageCode, voiceType);

      let botResponse = "";
      let pending = []; // Dùng để lưu các chunk chưa tạo audio

      for await (const chunk of response) {
        const chunkText = chunk.text;
        botResponse += chunkText;

        if (chunkText) {
          // Kiểm tra ký tự cuối cùng của chunkText
          const lastChar = chunkText.trim().slice(-1);

          // Nếu ký tự cuối cùng là một chữ cái, thêm vào pending và gửi text
          if (/[a-zA-ZÀ-ÿ]/.test(lastChar)) {
            pending.push(chunkText);
            res.write(
              `${JSON.stringify({
                text: chunkText,
                audio: null, // Không tạo audio cho chunk này
              })}\n\n\n`
            );
            continue;
          }

          // Nếu không phải chữ cái (dấu câu hoặc khoảng trắng), tạo audio cho tất cả các chunk đã pending
          if (pending.length > 0) {
            pending.push(chunkText); // Thêm chunk hiện tại vào pending
            const combined = cleanMarkdown(removeMd(pending.join("")));
            const ttsReq = {
              input: { text: combined },
              voice: {
                languageCode,
                name: voiceName,
              },
              audioConfig: { audioEncoding: "MP3" },
            };
            const [ttsRes] = await client.synthesizeSpeech(ttsReq);

            // Gửi audio cho các chunk đã pending
            res.write(
              `${JSON.stringify({
                text: chunkText, // Gửi tất cả các chunk đã ghép lại
                audio: ttsRes.audioContent.toString("base64"), // Audio từ các chunk ghép lại
              })}\n\n\n`
            );

            // Reset pending sau khi đã gửi audio
            pending = [];
          } else {
            const combined = cleanMarkdown(removeMd(chunkText));
            const ttsReq = {
              input: { text: combined },
              voice: {
                languageCode,
                name: voiceName,
              },
              audioConfig: { audioEncoding: "MP3" },
            };
            const [ttsRes] = await client.synthesizeSpeech(ttsReq);

            // Nếu không có chunk nào trong pending, chỉ gửi chunk hiện tại
            res.write(
              `${JSON.stringify({
                text: chunkText,
                audio: ttsRes.audioContent.toString("base64"), // Không tạo audio cho chunk này
              })}\n\n\n`
            );
          }
        }
      }

      // Kết thúc stream
      res.end();

      instantLecture.history.push({ role: "model", text: botResponse });

      // Tạo cache chat (yêu cầu token quá lớn)
      // const cache = await genAI.caches.create({
      //   model: "gemini-1.5-flash-001",
      //   config: {
      //     contents: [
      //       {
      //         role: "user",
      //         parts: [{ text: message }],
      //       },
      //       {
      //         role: "model",
      //         parts: [{ text: botResponse }],
      //       },
      //     ],
      //     systemInstruction: context,
      //   },
      // });

      // instantLecture.cacheName = cache.name;

      // Tạo lectureName
      const lectureNamePrompt = `
          You are an AI assistant that generates concise lecture titles. Based on the content below, generate **one** short and clear lecture title (4 to 6 words) in language ${language}.

          Content: "${botResponse}"

          Only return the title text. Do not include lists, numbering, or explanations.`;

      const titleResult = await genAI.models.generateContent({
        model: "gemini-2.0-flash",
        contents: lectureNamePrompt,
      });

      lectureName =
        titleResult.candidates[0].content.parts[0].text
          .trim()
          .replace(/^["']|["']$/g, "") ??
        message.trim().split(/\s+/).slice(0, 5).join(" ");

      instantLecture.lectureName = lectureName;

      await instantLecture.save();
    } catch (error) {
      next(error);
    }
  }

  // [POST] /instant-lecture/:id
  async sendMessage(req, res, next) {
    try {
      const { id } = req.params;
      const { message, teachingStyle, languageCode, language, voiceType } =
        req.body;
      const imageUrl = req.file?.location;
      if (!imageUrl && !message) {
        return res.status(400).json({ error: "Missing required fields." });
      }

      const instantLecture = await InstantLecture.findById(id);
      if (!instantLecture) {
        return res.status(404).json({ error: "Chat history not found." });
      }

      let image;
      if (imageUrl) {
        const uploadedImage = await downloadFileFromS3(imageUrl);

        const tempDir = path.join(__dirname, "../temp");
        await fs.mkdir(tempDir, { recursive: true });

        const imagePath = path.join(tempDir, `image-${Date.now()}.png`);
        await fs.writeFile(imagePath, uploadedImage);

        image = await genAI.files.upload({
          file: imagePath,
          config: { mimeType: "image/png" },
        });

        // Remove temporary image after uploading
        await fs
          .unlink(imagePath)
          .then(() => console.log("Temporary image file deleted."))
          .catch((err) =>
            console.error("Error deleting temporary image file:", err)
          );
      }

      let context = `
        You are a knowledgeable, patient, and engaging AI teacher. Your job is to assist the user by explaining content in a way that is clear, informative, and tailored to their needs. 
        Your teaching style is: "${teachingStyle}". You **MUST use the language "${language}" for all your responses**, regardless of what language the questioner uses..

        If the user uploads an image without any accompanying message, assume they want you to analyze and explain the content of the image as if you were giving a mini-lecture to a curious learner. 
        Start by identifying the subject of the image, then explain any key features, possible interpretations, and related concepts — all while keeping your explanation accessible and engaging.

        If the user provides a message (with or without an image), prioritize addressing their request. Use the teaching style "${teachingStyle}" to make your response helpful, concise, and easy to understand. 
        Include relevant examples or explanations where appropriate.

        Always ensure your tone remains warm, professional, and pedagogical — as if you are helping a student one-on-one.
      `;

      // if (message) {
      //   context += `\n\nUser message: ${message}`;
      // }

      const lectureHistory = instantLecture.history;
      const userMessage =
        lectureHistory.length < 90
          ? `
            Previous model response: ${
              lectureHistory[lectureHistory.length - 1].text
            }

            Requirement: ${message}
          `
          : message;

      // Nếu lịch sử chat đủ dài thì có thể tạo cache
      let cacheName = instantLecture.cacheName;
      if (lectureHistory.length > 90) {
        const cacheContents = buildRecentCacheContents(
          lectureHistory,
          lectureHistory.length
        );
        const cache = await genAI.caches.create({
          model: "gemini-1.5-flash-001",
          config: {
            contents: cacheContents,
            systemInstruction: context,
          },
        });
        cacheName = cache.name;
      }

      const chat = genAI.chats.create({
        model: "gemini-2.0-flash",
        // history: instantLecture.history,
      });

      const result = image
        ? await genAI.models.generateContentStream({
            model: "gemini-2.0-flash",
            contents: [
              createUserContent([
                userMessage ?? "",
                createPartFromUri(image.uri, image.mimeType),
              ]),
            ],
            config: {
              systemInstruction: context,
              ...(cacheName && { cachedContent: cacheName }),
            },
          })
        : await chat.sendMessageStream({
            message: userMessage,
            config: {
              systemInstruction: context,
              ...(cacheName && { cachedContent: cacheName }),
            },
          });

      console.log("result", result);

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const voiceName = await getVoiceName(languageCode, voiceType);

      let botResponse = "";
      let pending = []; // Dùng để lưu các chunk chưa tạo audio

      for await (const chunk of result) {
        const chunkText = chunk.text;
        botResponse += chunkText;

        if (chunkText) {
          // Kiểm tra ký tự cuối cùng của chunkText
          const lastChar = chunkText.trim().slice(-1);

          // Nếu ký tự cuối cùng là một chữ cái, thêm vào pending và gửi text
          if (/[a-zA-ZÀ-ÿ]/.test(lastChar)) {
            pending.push(chunkText);
            res.write(
              `${JSON.stringify({
                text: chunkText,
                audio: null, // Không tạo audio cho chunk này
              })}\n\n\n`
            );
            continue;
          }

          // Nếu không phải chữ cái (dấu câu hoặc khoảng trắng), tạo audio cho tất cả các chunk đã pending
          if (pending.length > 0) {
            pending.push(chunkText); // Thêm chunk hiện tại vào pending
            const combined = cleanMarkdown(removeMd(pending.join("")));
            const ttsReq = {
              input: { text: combined },
              voice: {
                languageCode,
                name: voiceName,
              },
              audioConfig: { audioEncoding: "MP3" },
            };
            const [ttsRes] = await client.synthesizeSpeech(ttsReq);

            // Gửi audio cho các chunk đã pending
            res.write(
              `${JSON.stringify({
                text: chunkText, // Gửi tất cả các chunk đã ghép lại
                audio: ttsRes.audioContent.toString("base64"), // Audio từ các chunk ghép lại
              })}\n\n\n`
            );

            // Reset pending sau khi đã gửi audio
            pending = [];
          } else {
            const combined = cleanMarkdown(removeMd(chunkText));
            const ttsReq = {
              input: { text: combined },
              voice: {
                languageCode,
                name: voiceName,
              },
              audioConfig: { audioEncoding: "MP3" },
            };
            const [ttsRes] = await client.synthesizeSpeech(ttsReq);

            // Nếu không có chunk nào trong pending, chỉ gửi chunk hiện tại
            res.write(
              `${JSON.stringify({
                text: chunkText,
                audio: ttsRes.audioContent.toString("base64"), // Không tạo audio cho chunk này
              })}\n\n\n`
            );
          }
        }
      }

      // Kết thúc stream
      res.end();

      try {
        if (botResponse.trim()) {
          const botMessage = botResponse;
          instantLecture.history.push({
            role: "user",
            text: message,
            imageUrl: imageUrl ?? null,
          });

          instantLecture.history.push({ role: "model", text: botMessage });
        }

        await instantLecture.save();
      } catch (err) {
        console.error("Error saving lecture history:", err);
      }
      console.log("instantLecture", instantLecture);
    } catch (error) {
      next(error);
    }
  }

  // [PUT] /instant-lecture/:id
  async updateInstantLecture(req, res, next) {
    try {
      const { id } = req.params;
      const { lectureName } = req.body;

      const instantLecture = await InstantLecture.findById(id);
      if (!instantLecture) {
        return res.status(404).json({ error: "Instant lecture not found." });
      }

      instantLecture.lectureName = lectureName;
      await instantLecture.save();

      res.status(200).json(instantLecture);
    } catch (error) {
      next(error);
    }
  }

  // [DELETE] /instant-lecture/:id
  async deleteInstantLecture(req, res, next) {
    try {
      const { id } = req.params;

      const instantLecture = await InstantLecture.findByIdAndDelete(id);
      if (!instantLecture) {
        return res.status(404).json({ error: "Instant lecture not found." });
      }

      res
        .status(200)
        .json({ message: "Instant lecture deleted successfully." });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new InstantLectureController();
