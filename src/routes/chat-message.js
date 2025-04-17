const express = require("express");
const router = express.Router();
const { verifyToken } = require("../app/middleware/authMiddleware");
const ChatMessageController = require("../app/controllers/ChatMessageController");
const {
  validateCreateChatMessage,
} = require("../app/middleware/chatMessageMiddleware");

router.get("/:lectureId", verifyToken, ChatMessageController.getChatMessages);
router.post(
  "/",
  verifyToken,
  validateCreateChatMessage,
  ChatMessageController.createChatMessage
);

module.exports = router;
