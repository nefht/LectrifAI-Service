const { GoogleGenAI } = require("@google/genai");
const {
  generateQuizWithGoogleAIV1,
  checkShortAnswer,
  generateQuizWithGoogleAIV2,
} = require("../../utils/google-ai");
const Quiz = require("../models/Quiz");
const QuizPermission = require("../models/permissions/QuizPermission");
const ClassroomQuiz = require("../models/Classroom/ClassroomQuiz");

const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY);

class QuizController {
  // [GET] /quiz
  async getQuizzes(req, res, next) {
    try {
      const userId = req.user.id;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      const { search, sortBy = "createdAt", order = "desc" } = req.query;

      // Tạo filter object
      let filter = {};

      // Lấy các quiz mà người dùng có quyền truy cập
      const permissions = await QuizPermission.find({
        userId,
        permissionType: { $in: ["VIEWER", "EDITOR"] },
      }).select("quizId");
      const quizIds = permissions.map((permission) => permission.quizId);

      filter = {
        $or: [{ userId }, { isPublic: true }, { _id: { $in: quizIds } }],
      };

      if (search) {
        filter = {
          ...filter,
          $or: [
            { topic: { $regex: search, $options: "i" } },
            { documentText: { $regex: search, $options: "i" } },
            { fileUrl: { $regex: search, $options: "i" } },
            { quizName: { $regex: search, $options: "i" } },
            { "quizData.quizzes.question": { $regex: search, $options: "i" } },
            { "quizData.quizzes.answer": { $regex: search, $options: "i" } },
            {
              "quizData.quizzes.explanation": { $regex: search, $options: "i" },
            },
            {
              "quizData.quizzes.options": {
                $elemMatch: { $regex: search, $options: "i" },
              },
            },
          ],
        };
      }

      // Tạo sort object
      const sort = {};
      sort[sortBy] = order === "asc" ? 1 : -1;

      const [total, quizzes] = await Promise.all([
        Quiz.countDocuments(filter),
        Quiz.find(filter).sort(sort).skip(skip).limit(limit),
      ]);

      res.status(200).json({
        data: quizzes,
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
  // [GET] /quiz/:id
  async getQuizById(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const quiz = await Quiz.findById(id);
      if (!quiz) {
        return res.status(404).json({ error: "Quiz not found." });
      }

      // Kiểm tra quyền truy cập
      if (!quiz.isPublic) {
        const owner = quiz.userId.toString() === userId;
        const permissions = await QuizPermission.findOne({
          userId,
          quizId: id,
        });

        // Lấy danh sách lớp học được cấp quyền vào quiz
        const quizClassrooms = await ClassroomQuiz.find({
          quizId: id,
        }).populate("classroomId", "students userId");

        // Kiểm tra người dùng có trong lớp học được cấp quyền vào quiz không
        const userInClassroom = quizClassrooms.some((classroomQuiz) => {
          const classroom = classroomQuiz.classroomId;
          return (
            classroom.students.includes(userId) ||
            classroom.userId.toString() === userId
          );
        });

        if (!owner && !permissions && !userInClassroom) {
          return res.status(403).json({ error: "Access denied." });
        }
      }

      res.status(200).json(quiz);
    } catch (error) {
      next(error);
    }
  }

  // [POST] /quiz/v1 - Create quiz with topic text
  async createQuizV1(req, res, next) {
    const userId = req.user.id;
    const {
      topic,
      documentText,
      academicLevel,
      language,
      questionType,
      numberOfQuestions,
      specificRequirements,
    } = req.body;

    try {
      const response = await generateQuizWithGoogleAIV1(
        topic,
        documentText,
        academicLevel,
        language,
        questionType,
        numberOfQuestions,
        specificRequirements
      );

      const rawText = response.candidates[0]?.content?.parts[0]?.text;
      if (!rawText) {
        throw new Error("No valid content returned from AI API.");
      }

      let quizData;
      try {
        quizData = JSON.parse(rawText.replace(/```json|```/g, "").trim());
      } catch (err) {
        throw new Error("Error parsing JSON content: " + err.message);
      }

      if (!quizData || !quizData.quizzes || quizData.quizzes.length === 0) {
        throw new Error("No quiz data returned from AI API.");
      }

      let quizName = "New Quiz";
      if (topic) {
        quizName = topic;
      } else if (documentText) {
        const createNamePrompt = `
          You are an AI assistant that generates concise quiz titles. Based on the content below, generate **one** short and clear quiz title (4 to 6 words) in language ${language}.

          Content: "${documentText}"

          Only return the title text. Do not include lists, numbering, or explanations.`;

        const titleResult = await genAI.models.generateContent({
          model: "gemini-1.5-flash-8b",
          contents: createNamePrompt,
        });

        quizName =
          titleResult.candidates[0].content.parts[0].text
            .trim()
            .replace(/^["']|["']$/g, "") ?? "New Quiz";
      }

      const quiz = new Quiz({
        userId,
        topic,
        documentText,
        quizName,
        academicLevel,
        language,
        questionType,
        quizData,
      });
      await quiz.save();

      const QuizPermission = new QuizPermission({
        userId,
        quizId: quiz._id,
        permissionType: "OWNER",
      });
      await QuizPermission.save();

      res.json(quiz);
    } catch (error) {
      next(error);
    }
  }

  // [POST] /quiz/v2 - Create quiz from file
  async createQuizV2(req, res, next) {
    const userId = req.user.id;
    const fileUrl = req.file?.location;
    const {
      file,
      academicLevel,
      language,
      questionType,
      numberOfQuestions,
      specificRequirements,
    } = req.body;

    try {
      const response = await generateQuizWithGoogleAIV2(
        fileUrl,
        academicLevel,
        language,
        questionType,
        numberOfQuestions,
        specificRequirements
      );

      const rawText = response.candidates[0]?.content?.parts[0]?.text;
      if (!rawText) {
        throw new Error("No valid content returned from AI API.");
      }

      let quizData;
      try {
        quizData = JSON.parse(rawText.replace(/```json|```/g, "").trim());
      } catch (err) {
        throw new Error("Error parsing JSON content: " + err.message);
      }

      if (!quizData || !quizData.quizzes || quizData.quizzes.length === 0) {
        throw new Error("No quiz data returned from AI API.");
      }

      const quiz = new Quiz({
        userId,
        fileUrl,
        quizName: file?.originalname ?? "New Quiz",
        academicLevel,
        language,
        questionType,
        quizData,
      });
      await quiz.save();
      res.json(quiz);
    } catch (error) {
      next(error);
    }
  }

  // [POST] /check-short-answer - Check short answer quiz
  async checkUserShortAnswer(req, res, next) {
    const { question, answer, explanation, points, userAnswer } = req.body;

    try {
      if (!question || !answer || !points || !userAnswer) {
        return res.status(400).json({ error: "Missing required fields." });
      }

      const response = await checkShortAnswer(
        question,
        answer,
        explanation,
        points,
        userAnswer
      );

      const rawText = response.candidates[0]?.content?.parts[0]?.text;
      if (!rawText) {
        throw new Error("No valid content returned from AI API.");
      }

      let feedback;
      try {
        feedback = JSON.parse(rawText.replace(/```json|```/g, "").trim());
      } catch (err) {
        throw new Error("Error parsing JSON content: " + err.message);
      }

      if (!feedback) {
        throw new Error("No feedback data returned from AI API.");
      }

      res.json(feedback);
    } catch (error) {
      next(error);
    }
  }

  // [PATCH] /quiz/:id - Update quiz question
  async updateQuiz(req, res, next) {
    const { id } = req.params;
    const userId = req.user.id;
    const { quizData } = req.body;

    try {
      const quiz = await Quiz.findOneAndUpdate(
        { _id: id, userId },
        { quizData },
        { new: true }
      );

      if (!quiz) {
        return res.status(404).json({ error: "Quiz not found." });
      }

      res.status(200).json(quiz);
    } catch (error) {
      next(error);
    }
  }

  // [PATCH] /info/:id - Update quiz info
  async updateQuizInfo(req, res, next) {
    const { id } = req.params;
    const userId = req.user.id;
    const { quizName, academicLevel } = req.body;

    try {
      const quiz = await Quiz.findOneAndUpdate(
        { _id: id, userId },
        { quizName, academicLevel },
        { new: true }
      );

      if (!quiz) {
        return res.status(404).json({ error: "Quiz not found." });
      }

      res.status(200).json(quiz);
    } catch (error) {
      next(error);
    }
  }

  // [DELETE] /quiz/:id - Delete quiz
  async deleteQuiz(req, res, next) {
    const { id } = req.params;
    const userId = req.user.id;

    try {
      const quiz = await Quiz.findOneAndDelete({ _id: id, userId });

      if (!quiz) {
        return res.status(404).json({ error: "Quiz not found." });
      }

      res.status(200).json({ message: "Quiz deleted successfully." });
    } catch (error) {
      next(error);
    }
  }

  // [POST] /quiz/share/:id - Share quiz with user
  async shareQuiz(req, res, next) {
    try {
      const userId = req.user.id;
      const quizId = req.params.id;
      const { isPublic, sharedWith } = req.body;

      const quiz = await Quiz.findOne({ _id: quizId, userId });
      if (!quiz) {
        return res.status(404).json({ error: "Quiz not found." });
      }

      if (isPublic) {
        quiz.isPublic = isPublic;
      }

      if (!isPublic && sharedWith && sharedWith.length > 0) {
        for (const user of sharedWith) {
          if (user.permissionType === "REMOVE") {
            // Xóa quyền của người dùng nếu permissionType là 'REMOVE'
            await QuizPermission.findOneAndDelete({
              quizId,
              userId: user.userId,
            });
          } else {
            await QuizPermission.findOneAndUpdate(
              {
                userId: user.userId,
                quizId,
              },
              { $set: { permissionType: user.permissionType } }, // Thay đổi giá trị của permissionType
              { upsert: true } // Tạo mới nếu không tìm thấy
            );
          }
        }
      }

      const permissions = await QuizPermission.find({
        quizId,
      }).populate("userId", "account fullName email");

      res.status(200).json({
        message: "Quiz shared successfully.",
        quiz,
        sharedWith: permissions.map((permission) => {
          return {
            userId: permission.userId._id,
            account: permission.userId.account,
            fullName: permission.userId.fullName,
            email: permission.userId.email,
            permissionType: permission.permissionType,
          };
        }),
      });
    } catch (error) {
      next(error);
    }
  }

  // [GET] /quiz/share/:id - Lấy danh sách người dùng có quyền truy cập quiz
  async getQuizPermissions(req, res, next) {
    try {
      const userId = req.user.id;
      const quizId = req.params.id;

      const quiz = await Quiz.findOne({ _id: quizId, userId });
      if (!quiz) {
        return res.status(404).json({ error: "Quiz not found." });
      }

      const permissions = await QuizPermission.find({
        quizId,
      }).populate("userId", "account fullName email");

      const sharedWith = permissions.map((permission) => {
        return {
          userId: permission.userId._id,
          account: permission.userId.account,
          fullName: permission.userId.fullName,
          email: permission.userId.email,
          permissionType: permission.permissionType,
        };
      });

      res.status(200).json(sharedWith);
    } catch (error) {
      next(error);
    }
  }

  // [GET] /quiz/permission/:id - Lấy quyền của người dùng với quiz
  async getUserPermissionWithQuiz(req, res, next) {
    try {
      const userId = req.user.id;
      const quizId = req.params.id;

      const permission = await QuizPermission.findOne({
        userId,
        quizId,
      }).populate("userId", "account fullName email");

      // if (!permission) {
      //   return res.status(404).json({ error: "Permission not found." });
      // }

      res.status(200).json(permission);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new QuizController();
