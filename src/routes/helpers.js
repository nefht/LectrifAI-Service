const express = require("express");
const router = express.Router();
const HelpersController = require("../app/controllers/HelpersController");
const { verifyToken } = require("../app/middleware/authMiddleware");

router.get("/languages-list", HelpersController.getAllLanguagesList);
router.get("/text-to-speech-voices", HelpersController.getTextToSpeechVoiceList);
router.get("/search", verifyToken, HelpersController.searchByCategory);

module.exports = router;