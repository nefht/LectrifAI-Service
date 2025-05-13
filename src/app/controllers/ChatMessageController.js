const ChatMessage = require("../models/ChatMessage");
const LectureScript = require("../models/LectureScript");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

class ChatMessageController {
  // [GET] /chat-message/:lectureId
  async getChatMessages(req, res, next) {
    try {
      const userId = req.user.id;
      const { lectureId } = req.params;

      if (!lectureId) {
        return res.status(400).json({ error: "Missing lectureId parameter." });
      }

      const chatHistory = await ChatMessage.findOne({ userId, lectureId });

      if (!chatHistory) {
        return res.status(200).json({ chatHistory: [] });
      }

      res.status(200).json({ chatHistory: chatHistory.history });
    } catch (error) {
      next(error);
    }
  }

  // [POST] /chat-message
  async createChatMessage(req, res, next) {
    try {
      const userId = req.user.id;
      const { lectureId, lectureScriptId, message } = req.body;
      if (!lectureId || !message) {
        return res.status(400).json({ error: "Missing required fields." });
      }

      let chatHistory = await ChatMessage.findOne({ userId, lectureId });
      if (!chatHistory) {
        chatHistory = new ChatMessage({ userId, lectureId, history: [] });
      }

      let lectureContext = `
        You are a highly knowledgeable AI assistant. 
        Please provide detailed, accurate, and well-structured answers to the user's questions. 
        Your responses should be easy to understand and include necessary explanations. 
        If relevant, break down complex topics into smaller parts. 
        Use examples when appropriate and provide step-by-step guidance if needed.
      `;

      let lectureScript = await LectureScript.findById(lectureScriptId);
      if (lectureScript) {
        const lectureContent = lectureScript.lectureScript.slides
          .map((slide) => slide.script)
          .join("\n\n");

        const quizData =
          lectureScript.lectureScript.slides
            .filter((slide) => slide.quiz !== null)
            .map((slide, index) => {
              if (
                slide.quiz &&
                slide.quiz.options &&
                slide.quiz.question &&
                slide.quiz.answer
              ) {
                return `Quiz ${index + 1}: ${
                  slide?.quiz?.question
                }\nOptions: ${slide.quiz.options.join(", ")}\nAnswer: ${
                  slide?.quiz?.answer
                }\n`;
              }
              return null;
            })
            .filter((quiz) => quiz !== null)
            .join("\n") ?? "There are no quizzes available for this lecture.";

        lectureContext = `
          You are an AI tutor specializing in this lecture. 
          Use the following lecture content and quiz data to provide precise answers:
          
          === LECTURE CONTENT ===
          ${lectureContent}

          === QUIZZES ===
          ${quizData}
          
          Please ensure that your responses are detailed, well-structured, and easy to understand. 
          If the user asks a general question, provide an answer in the context of the lecture if possible.
        `;
      }

      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      const chat = model.startChat();

      const fullMessage = `${lectureContext}\n\n${message}`;

      // Gửi tin nhắn theo kiểu stream
      const result = await chat.sendMessageStream(fullMessage);

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      let botResponse = "";
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        botResponse += chunkText;
        res.write(chunkText);
      }
      // Kết thúc stream
      res.end();

      // Cập nhật lịch sử chat
      chatHistory.history.push({ role: "user", text: message });
      chatHistory.history.push({
        role: "model",
        text: botResponse,
      });

      await chatHistory.save();
    } catch (error) {
      next(error);
    }
  }

  // [DELETE] /delete/:lectureId
  async deleteChatMessage(req, res, next) {
    try {
      const userId = req.user.id;
      const { lectureId } = req.params;

      if (!lectureId) {
        return res.status(400).json({ error: "Missing lectureId parameter." });
      }

      const chatHistory = await ChatMessage.findOneAndDelete({
        userId,
        lectureId,
      });

      if (!chatHistory) {
        return res.status(404).json({ error: "Chat history not found." });
      }

      res.status(200).json({ message: "Chat history deleted successfully." });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ChatMessageController();
