const { generateLectureScriptWithGoogleAI } = require("../../utils/google-ai");
const LectureScript = require("../models/LectureScript");
const LectureVideoPermission = require("../models/permissions/LectureVideoPermission");
const UploadedSlide = require("../models/UploadedSlide");

class LectureScriptController {
  // [GET] /lecture-script
  async getLectureScripts(req, res, next) {
    try {
      const userId = req.user.id;

      // Kiểm tra quyền truy cập
      const permissions = await LectureVideoPermission.find({
        userId: userIdObject,
        permissionType: { $in: ["VIEWER", "EDITOR"] },
      }).select("lectureScriptId");

      const lectureScriptIds = permissions.map(
        (permission) => permission.lectureScriptId
      );

      const filter = {
        $or: [
          { userId },
          { isPublic: true },
          { _id: { $in: lectureScriptIds } },
        ],
      };

      const lectureScripts = await LectureScript.find(filter).sort({
        createdAt: -1,
      })

      res.status(200).json(lectureScripts);
    } catch (error) {
      next(error);
    }
  }

  // [GET] /lecture-script/:id
  async getLectureScriptById(req, res, next) {
    try {
      const userId = req.user.id;
      const lectureScriptId = req.params.id;
      const lectureScript = await LectureScript.findById(lectureScriptId);
      if (!lectureScript) {
        return res.status(404).json({ error: "Lecture script not found." });
      }

      // Kiểm tra quyền truy cập
      if (!lectureScript.isPublic) {
        const owner = lectureScript.userId.toString() === userId;
        const permissions = await LectureVideoPermission.find({
          userId,
          lectureScriptId,
        });
        if (!owner && !permissions) {
          return res.status(403).json({ error: "Access denied." });
        }
      }

      res.status(200).json(lectureScript);
    } catch (error) {
      next(error);
    }
  }

  // [POST] /lecture-script
  async createLectureScript(req, res, next) {
    const userId = req.user.id;
    const {
      fileId,
      academicLevel,
      language,
      voiceType,
      backgroundMusic,
      voiceStyle,
      lectureSpeed,
      lectureLength,
      interactiveQuiz,
      specificRequirements,
    } = req.body;

    try {
      const uploadedFile = await UploadedSlide.findById(fileId);
      if (!uploadedFile) {
        return res.status(404).json({ error: "File not found." });
      }

      const response = await generateLectureScriptWithGoogleAI(
        uploadedFile,
        academicLevel,
        voiceStyle,
        language,
        lectureLength,
        interactiveQuiz,
        specificRequirements
      );
      console.log(response);

      const rawText = response.candidates[0]?.content?.parts[0]?.text;
      if (!rawText) {
        throw new Error("No valid content returned from AI API.");
      }
      console.log(rawText);

      let lectureScriptData;
      try {
        lectureScriptData = JSON.parse(
          rawText.replace(/```json|```/g, "").trim()
        );
      } catch (err) {
        throw new Error("Error parsing JSON content: " + err.message);
      }

      if (!lectureScriptData) {
        throw new Error("No lecture script generated from AI API response.");
      }

      const lectureScript = new LectureScript({
        userId,
        fileId,
        lectureScript: lectureScriptData,
        academicLevel,
        language,
        voiceType,
        backgroundMusic,
        voiceStyle,
        lectureSpeed,
        lectureLength,
        interactiveQuiz,
        specificRequirements,
      });
      await lectureScript.save();
      res.status(201).json(lectureScript);
    } catch (error) {
      next(error);
    }
  }

  // [PATCH] /lecture-script/:id
  async updateLectureScript(req, res, next) {
    try {
      const userId = req.user.id;
      const lectureScriptId = req.params.id;
      const lectureScript = req.body;

      const updatedLectureScript = await LectureScript.findOneAndUpdate(
        { _id: lectureScriptId, userId },
        lectureScript,
        { new: true }
      );

      if (!updatedLectureScript) {
        return res.status(404).json({ error: "Lecture script not found." });
      }

      res.status(200).json(updatedLectureScript);
    } catch (error) {
      next(error);
    }
  }

  // [PATCH] /lecture-script/edit-quiz/:id
  async editQuiz(req, res, next) {
    try {
      const userId = req.user.id;
      const lectureScriptId = req.params.id;
      const lectureScript = req.body;

      const oldLectureScript = await LectureScript.findById(lectureScriptId);

      // Kiểm tra quyền truy cập
      const owner = oldLectureScript.userId.toString() === userId;
      const permission = await LectureVideoPermission.findOne({
        userId,
        lectureScriptId,
      });
      if (!owner && !permission.permissionType === "EDITOR") {
        return res.status(403).json({ error: "Access denied." });
      } 

      oldLectureScript.lectureScript = lectureScript;
      await oldLectureScript.save();
      res.status(200).json(oldLectureScript);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new LectureScriptController();
