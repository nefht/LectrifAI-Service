const express = require("express");
const router = express.Router();
const HelpersController = require("../app/controllers/HelpersController");

router.get("/languages-list", HelpersController.getAllLanguagesList);
router.get("/text-to-speech-voices", HelpersController.getTextToSpeechVoiceList);

module.exports = router;