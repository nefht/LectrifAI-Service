const { ObjectId } = require("mongoose").Types;
const { GoogleGenAI } = require("@google/genai");
const { v4: uuidv4 } = require("uuid");
const {
  generateQuizWithGoogleAIV1,
  checkShortAnswer,
  generateQuizWithGoogleAIV2,
} = require("../../utils/google-ai");
const Quiz = require("../models/Quiz");
const QuizPermission = require("../models/permissions/QuizPermission");
const ClassroomQuiz = require("../models/Classroom/ClassroomQuiz");
const MultipleQuizRoom = require("../models/MultipleQuizRoom");
const { deleteFileFromS3 } = require("../../utils/aws-s3");

const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY);

class QuizController {
  // [GET] /quiz
  async getQuizzes(req, res, next) {
    try {
      const userId = req.user.id;
      const userIdObject = new ObjectId(userId);

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      const { search, sortBy = "createdAt", order = "desc" } = req.query;

      // Lấy các quiz mà người dùng có quyền truy cập
      const permissions = await QuizPermission.find({
        userId,
        permissionType: { $in: ["VIEWER", "EDITOR"] },
      }).select("quizId");
      const quizIds = permissions.map((permission) => permission.quizId);

      const accessFilter = {
        $or: [
          { userId: userIdObject },
          // { isPublic: true },
          { _id: { $in: quizIds } },
        ],
      };

      // Build aggregation pipeline
      const pipeline = [];

      // filter quyền truy cập trước
      pipeline.push({ $match: accessFilter });

      // nếu có search thì filter tiếp
      if (search) {
        pipeline.push({
          $match: {
            $or: [
              { topic: { $regex: search, $options: "i" } },
              { documentText: { $regex: search, $options: "i" } },
              { fileUrl: { $regex: search, $options: "i" } },
              { quizName: { $regex: search, $options: "i" } },
              {
                "quizData.quizzes.question": { $regex: search, $options: "i" },
              },
              { "quizData.quizzes.answer": { $regex: search, $options: "i" } },
              {
                "quizData.quizzes.explanation": {
                  $regex: search,
                  $options: "i",
                },
              },
              {
                "quizData.quizzes.options": {
                  $elemMatch: { $regex: search, $options: "i" },
                },
              },
            ],
          },
        });
      }

      // lookup owner
      pipeline.push(
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "owner",
            let: { ownerId: "$userId" },
            pipeline: [
              { $match: { $expr: { $eq: ["$_id", "$$ownerId"] } } },
              { $project: { account: 1, fullName: 1, _id: 1, avatarUrl: 1 } },
            ],
            as: "owner",
          },
        },
        {
          $unwind: {
            path: "$owner",
            preserveNullAndEmptyArrays: true,
          },
        }
      );

      // lookup tất cả permission (để xác định group share)
      pipeline.push({
        $lookup: {
          from: "quizpermissions",
          let: { quizId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$quizId", "$$quizId"] },
              },
            },
            { $project: { permissionType: 1, userId: 1, _id: 0 } },
          ],
          as: "permissions",
        },
      });

      // sort + paginate
      pipeline.push(
        { $sort: { [sortBy]: order === "asc" ? 1 : -1 } },
        {
          $facet: {
            data: [{ $skip: skip }, { $limit: limit }],
            totalCount: [{ $count: "count" }],
          },
        }
      );

      // Chạy aggregate
      const aggResult = await Quiz.aggregate(pipeline);
      const quizzes = aggResult[0].data || [];
      const total = aggResult[0].totalCount[0]?.count || 0;

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

      const quiz = await Quiz.findById(id).populate(
        "userId",
        "fullName email account avatarUrl"
      );
      if (!quiz) {
        return res.status(404).json({ error: "Quiz not found." });
      }

      // Kiểm tra quyền truy cập
      if (!quiz.isPublic) {
        const owner = quiz.userId._id.toString() === userId.toString();
        console.log("owner", owner);
        const permissions = await QuizPermission.findOne({
          userId,
          quizId: id,
        });
        console.log("permission", permissions);
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
        console.log("userInClassroom", userInClassroom);

        if (!owner && !permissions && !userInClassroom) {
          return res.status(403).json({ error: "Access denied." });
        }
      }

      res.status(200).json(quiz);
    } catch (error) {
      next(error);
    }
  }

  // [GET] /quiz/user/:userId
  async getQuizzesByUserId(req, res, next) {
    const currentUserId = req.user.id;
    const userId = req.params.userId;
    try {
      // Phân trang
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 10;
      const skip = (page - 1) * limit;

      const publicQuizzes = await Quiz.find({
        userId,
        isPublic: true,
      })
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .populate("userId", "account fullName email avatarUrl");

      const totalPublicQuizzes = await Quiz.countDocuments({
        userId,
        isPublic: true,
      });

      return res.json({
        data: publicQuizzes,
        pagination: {
          total: totalPublicQuizzes,
          page,
          limit,
          totalPages: Math.ceil(totalPublicQuizzes / limit),
        },
      });
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
          model: "gemini-2.0-flash", // gemini-1.5-flash-8b -> gemini-2.0-flash
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

      const quizPermission = new QuizPermission({
        userId,
        quizId: quiz._id,
        permissionType: "OWNER",
      });
      await quizPermission.save();

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
        quizName: quizData.quizName ?? "New Quiz",
        academicLevel,
        language,
        questionType,
        quizData,
      });
      await quiz.save();

      const quizPermission = new QuizPermission({
        userId,
        quizId: quiz._id,
        permissionType: "OWNER",
      });
      await quizPermission.save();

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
        { _id: id },
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
        { _id: id },
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
      const quiz = await Quiz.findOne({ _id: id, userId });

      if (!quiz) {
        return res.status(404).json({ error: "Quiz not found." });
      }

      await ClassroomQuiz.deleteMany({ quizId: id });

      if (quiz.fileUrl) {
        // Xóa file trên S3
        await deleteFileFromS3(quiz.fileUrl);
      }

      await Quiz.deleteOne({ _id: id, userId })
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

      // Kiểm tra số lượng người chia sẻ
      if (sharedWith && sharedWith.length > 200) {
        return res.status(400).json({
          error: "You can only share with a maximum of 200 users.",
        });
      }

      const quiz = await Quiz.findOne({ _id: quizId });
      if (!quiz) {
        return res.status(404).json({ error: "Quiz not found." });
      }

      quiz.isPublic = isPublic;

      await quiz.save();

      if (!isPublic && (!sharedWith || sharedWith.length === 0)) {
        await QuizPermission.deleteMany({
          quizId,
        });
      }

      if (sharedWith && sharedWith.length > 0) {
        // Xóa tất cả quyền chia sẻ cũ cho quiz
        await QuizPermission.deleteMany({ quizId });

        // Thêm quyền chia sẻ mới
        for (const user of sharedWith) {
          await QuizPermission.create({
            userId: user.userId,
            quizId,
            permissionType: user.permissionType,
          });
        }
      }

      const permissions = await QuizPermission.find({
        quizId,
      }).populate("userId", "account fullName email avatarUrl");

      res.status(200).json({
        message: "Quiz shared successfully.",
        quiz,
        sharedWith: permissions.map((permission) => {
          return {
            userId: permission.userId._id,
            account: permission.userId.account,
            fullName: permission.userId.fullName,
            email: permission.userId.email,
            avatarUrl: permission.userId.avatarUrl,
            permissionType: permission.permissionType,
          };
        }),
        isPublic: quiz.isPublic,
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

      const quiz = await Quiz.findById(quizId);
      if (!quiz) {
        return res.status(404).json({ error: "Quiz not found." });
      }

      const permissions = await QuizPermission.find({
        quizId,
      }).populate("userId", "account fullName email avatarUrl");

      const sharedWith = permissions.map((permission) => {
        return {
          userId: permission.userId._id,
          account: permission.userId.account,
          fullName: permission.userId.fullName,
          email: permission.userId.email,
          avatarUrl: permission.userId.avatarUrl,
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

  // [POST] /quiz/multiple-play
  async createMultiplePlayRoom(req, res, next) {
    try {
      const userId = req.user.id;
      const { quizId, timeLimit, maxPlayers } = req.body;

      const inviteToken = uuidv4();

      const room = new MultipleQuizRoom({
        userId,
        quizId,
        timeLimit,
        maxPlayers,
        players: [],
        inviteToken,
      });

      await room.save();
      res.status(200).json(room);
    } catch (error) {
      next(error);
    }
  }

  // [GET] /quiz/multiple-play/join/:token
  async joinMultiplePlayRoom(req, res, next) {
    try {
      const { token } = req.params;
      const userId = req.user.id;

      // Tìm phòng bằng token
      const room = await MultipleQuizRoom.findOne({ inviteToken: token });

      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }

      // Kiểm tra xem người dùng đã tham gia chưa
      if (room.players.includes(userId)) {
        return res
          .status(200)
          .json({ message: "You have already joined this room" });
      }

      // Kiểm tra xem phòng có còn chỗ không
      if (room.players.length >= room.maxPlayers) {
        return res.status(200).json({ message: "Room is full" });
      }

      // Thêm người chơi vào phòng
      room.players.push(userId);
      await room.save();

      // Trả về thông tin phòng và số người chơi hiện tại
      res.status(200).json({
        message: "Joined room successfully",
        roomId: room._id,
        players: room.players,
      });
    } catch (error) {
      next(error);
    }
  }

  // [GET] /multiple-play/:id
  async getRoomInfo(req, res, next) {
    try {
      const userId = req.user.id;
      const id = req.params.id;

      const room = await MultipleQuizRoom.findById(id);

      res.json(room);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new QuizController();
