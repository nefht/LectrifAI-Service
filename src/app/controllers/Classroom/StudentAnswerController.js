const { default: mongoose } = require("mongoose");
const { checkShortAnswer } = require("../../../utils/google-ai");
const Classroom = require("../../models/Classroom/Classroom");
const ClassroomQuiz = require("../../models/Classroom/ClassroomQuiz");
const StudentAnswer = require("../../models/Classroom/StudentAnswer");
const Quiz = require("../../models/Quiz");
const User = require("../../models/User");

class StudentAnswerController {
  // [POST] /student-answer/start-quiz
  async startQuiz(req, res, next) {
    try {
      const userId = req.user.id;
      const { classroomQuizId } = req.body;

      const classroomQuiz = await ClassroomQuiz.findById(classroomQuizId);

      if (!classroomQuiz) {
        return res.status(404).json({ message: "Classroom quiz not found" });
      }

      // Kiểm tra có phải là student trong lớp học không
      const classroom = await Classroom.findById(classroomQuiz.classroomId);
      if (!classroom) {
        return res.status(404).json({ message: "Classroom not found" });
      }

      const isStudent = classroom.students.includes(userId);

      if (!isStudent && !classroom.userId.equals(userId)) {
        return res
          .status(403)
          .json({ message: "Not a student in this classroom" });
      }

      // Kiểm tra xem student answer đã tồn tại chưa
      const existingStudentAnswer = await StudentAnswer.findOne({
        classroomQuizId,
        studentId: userId,
      });

      if (existingStudentAnswer) {
        return res.status(400).json({
          message: "Student answer already exists",
          studentAnswerId: existingStudentAnswer._id,
        });
      }

      const { startTime, endTime, duration } = classroomQuiz;

      let endedAt = null;
      const currentTime = new Date();
      if (currentTime > endTime) {
        return res.status(400).json({ message: "Quiz has expired" });
      } else if (currentTime < startTime) {
        return res.status(400).json({ message: "Quiz has not started yet" });
      }
      if (duration) {
        endedAt = new Date(currentTime.getTime() + duration * 1000);
      }

      const quizData = await Quiz.findById(classroomQuiz.quizId);

      const userAnswers = quizData.quizData.quizzes.map((quiz) => {
        return {
          ...quiz,
          userAnswer: "",
        };
      });

      const quizTotalScore = quizData.quizData.quizzes.reduce(
        (total, quiz) => total + quiz.points,
        0
      );

      const studentAnswer = await StudentAnswer.create({
        classroomQuizId,
        studentId: userId,
        userAnswers,
        quizTotalScore,
        startedAt: currentTime,
        endedAt,
        status: "in-progress",
      });

      res.status(201).json({
        studentAnswerId: studentAnswer._id,
        classroomQuizId: studentAnswer.classroomQuizId,
        startedAt: studentAnswer.startedAt,
        endedAt: studentAnswer.endedAt,
        status: studentAnswer.status,
      });
    } catch (error) {
      next(error);
    }
  }

  // [PUT] /student-answer/:id
  async updateStudentAnswer(req, res, next) {
    try {
      const userId = req.user.id;
      const id = req.params.id;
      const { userAnswers } = req.body;

      const studentAnswer = await StudentAnswer.findOne({
        _id: id,
        studentId: userId,
      });

      if (!studentAnswer) {
        return res.status(404).json({ message: "Student answer not found" });
      }

      const updatedStudentAnswer = studentAnswer.map((item, index) => {
        return {
          ...item,
          userAnswer: userAnswers[index],
        };
      });

      studentAnswer.userAnswers = updatedStudentAnswer;
      await studentAnswer.save();

      res.status(200).json({ message: "Student answer updated successfully" });
    } catch (error) {
      next(error);
    }
  }

  // [POST] /student-answer/submit/:id
  async submitStudentAnswer(req, res, next) {
    try {
      const userId = req.user.id;
      const id = req.params.id;

      const studentAnswer = await StudentAnswer.findOne({
        _id: id,
        studentId: userId,
      });

      if (!studentAnswer) {
        return res.status(404).json({ message: "Student answer not found" });
      }

      studentAnswer.status = "submitted";
      studentAnswer.submittedAt = Date.now();
      await studentAnswer.save();

      res
        .status(200)
        .json({ message: "Student answer submitted successfully" });
    } catch (error) {
      next(error);
    }
  }

  // [POST] /student-answer/grade/:id
  async gradeStudentAnswer(req, res, next) {
    try {
      const userId = req.user.id;
      const id = req.params.id; // id của bài làm của học sinh
      const studentAnswer = await StudentAnswer.findOne({
        _id: id,
        studentId: userId,
      });

      if (!studentAnswer) {
        return res.status(404).json({ message: "Student answer not found" });
      }

      const quizData = studentAnswer.userAnswers;
      let totalScore = 0;

      // Duyệt qua tất cả các câu trả lời của học sinh
      for (let i = 0; i < quizData.length; i++) {
        const quiz = quizData[i];

        if (quiz.questionType === "multiple choice") {
          // Chấm điểm cho câu hỏi multiple choice
          if (quiz.userAnswer === quiz.answer) {
            studentAnswer.userAnswers[i] = {
              ...studentAnswer.userAnswers[i],
              userScore: quiz.points, // Cập nhật điểm vào quiz
            };

            totalScore += quiz.points;
          } else {
            studentAnswer.userAnswers[i] = {
              ...studentAnswer.userAnswers[i],
              userScore: 0, // Cập nhật điểm vào quiz
            };
          }
        } else if (quiz.questionType === "short answer") {
          if (quiz.userAnswer !== "") {
            // Chấm điểm cho câu hỏi short answer bằng AI
            const response = await checkShortAnswer(
              quiz.question,
              quiz.answer,
              quiz.explanation,
              quiz.points,
              quiz.userAnswer
            );
            const rawText = response.candidates[0]?.content?.parts[0]?.text;
            if (!rawText) {
              throw new Error("No valid content returned from AI API.");
            }

            console.log(rawText);

            let feedback;
            try {
              feedback = JSON.parse(rawText.replace(/```json|```/g, "").trim());
            } catch (err) {
              throw new Error("Error parsing JSON content: " + err.message);
            }

            if (!feedback) {
              throw new Error("No feedback data returned from AI API.");
            }

            const userScore = feedback.userScore;

            // Lưu điểm của học sinh vào quiz
            studentAnswer.userAnswers[i] = {
              ...studentAnswer.userAnswers[i],
              userScore: userScore, // Cập nhật điểm vào quiz
              feedback: feedback.feedback, // Cập nhật feedback vào quiz
            };

            totalScore += userScore;
          } else {
            studentAnswer.userAnswers[i] = {
              ...studentAnswer.userAnswers[i],
              userScore: 0, // Cập nhật điểm vào quiz
              feedback: "Your answer is empty!", // Cập nhật feedback vào quiz
            };
          }
        }
      }

      // Cập nhật điểm cho học sinh
      studentAnswer.score = totalScore;
      studentAnswer.status = "graded";
      await studentAnswer.save();

      res.status(200).json({
        message: "Student answer graded successfully",
        studentAnswer: studentAnswer,
        score: totalScore,
      });
    } catch (error) {
      next(error);
    }
  }

  // [GET] /student-answer/:id
  async getStudentAnswerById(req, res, next) {
    try {
      const userId = req.user.id;
      const id = req.params.id; // id của bài làm của học sinh

      const studentAnswer = await StudentAnswer.findById(id).populate(
        "classroomQuizId",
        "quizId classroomId endTime startTime"
      );

      if (!studentAnswer) {
        return res.status(404).json({ message: "Student answer not found" });
      }

      const classroom = await Classroom.findOne({
        _id: studentAnswer?.classroomQuizId?.classroomId,
      });

      if (!classroom) {
        return res.status(404).json({ message: "Classroom not found" });
      }

      if (classroom.userId.toString() !== userId) {
        const currentTime = Date.now();
        if (
          (studentAnswer?.classroomQuizId?.endTime &&
            currentTime > studentAnswer?.classroomQuizId?.endTime) ||
          (studentAnswer?.classroomQuizId?.startTime &&
            currentTime < studentAnswer?.classroomQuizId?.startTime)
        ) {
          res.status(403).json({ message: "Access denied" });
        }
      }

      if (
        classroom.userId.toString() === userId ||
        studentAnswer.studentId.toString() === userId
      ) {
        const quiz = await Quiz.findById(studentAnswer.classroomQuizId.quizId);

        let responseData;
        if (
          studentAnswer.status === "submitted" ||
          studentAnswer.status === "graded" ||
          (studentAnswer.studentId.toString() !== userId &&
            classroom.userId.toString() === userId)
        ) {
          responseData = { ...studentAnswer._doc, quizName: quiz.quizName };
        } else {
          responseData = {
            ...studentAnswer._doc,
            quizName: quiz.quizName,
            userAnswers: studentAnswer.userAnswers.map((quiz) => {
              return {
                questionType: quiz.questionType,
                question: quiz.question,
                options: quiz.options,
                points: quiz.points,
                userAnswer: quiz.userAnswer,
              };
            }),
          };
        }

        res.status(200).json(responseData);
      } else {
        res.status(403).json({ message: "Access denied" });
      }
    } catch (error) {
      next(error);
    }
  }

  // [GET] /student-answer/status/:classroomQuizId  - by studentId && classroomQuizId
  async getAnswerStatusByClassroomQuizId(req, res, next) {
    try {
      const userId = req.user.id;
      const classroomQuizId = req.params.classroomQuizId;

      const studentAnswer = await StudentAnswer.findOne({
        classroomQuizId,
        studentId: userId,
      });

      if (!studentAnswer) {
        return res.status(200).json({
          message: "Student answer not found",
          studentAnswerStatus: "not started",
        });
      }

      res.status(200).json({
        studentAnswerId: studentAnswer._id,
        studentAnswerStatus: studentAnswer.status,
      });
    } catch (error) {
      next(error);
    }
  }

  // [GET] /student-answer/ranking/:classroomId - Get ranking for students in a classroom
  async getClassroomRanking(req, res, next) {
    try {
      const userId = req.user.id;
      const classroomId = req.params.classroomId;
      // Pagination parameters
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      const classroom = await Classroom.findById(classroomId);
      if (!classroom) {
        return res.status(404).json({ message: "Classroom not found" });
      }

      // Kiểm tra quyền truy cập
      const isStudent = classroom.students.includes(userId);
      const isOwner = classroom.userId.equals(userId);

      if (!isStudent && !isOwner) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Lấy tất cả classroom quizzes trong classroom
      const classroomQuizzes = await ClassroomQuiz.find({ classroomId });
      const classroomQuizIds = classroomQuizzes.map((quiz) => quiz._id);

      // Lấy tất cả students id
      const allStudentIds = classroom.students;

      // Lấy điểm số cho tất cả học sinh trong lớp
      const allStudentScores = await StudentAnswer.aggregate([
        {
          $match: {
            classroomQuizId: { $in: classroomQuizIds },
            studentId: { $in: allStudentIds },
            status: { $in: ["disconnected", "submitted", "graded"] },
          },
        },
        {
          $group: {
            _id: "$studentId",
            totalScore: { $sum: { $ifNull: ["$score", 0] } },
            quizCount: { $sum: 1 },
          },
        },
      ]);

      // Tạo map điểm số cho tất cả học sinh
      const scoreMap = {};
      allStudentScores.forEach((score) => {
        scoreMap[score._id.toString()] = {
          totalScore: score.totalScore,
          quizCount: score.quizCount,
        };
      });

      // Tạo mảng tất cả học sinh với điểm số
      const allStudents = allStudentIds.map((studentId) => {
        const id = studentId.toString();
        const scoreInfo = scoreMap[id] || { totalScore: 0, quizCount: 0 };
        return {
          studentId: studentId,
          totalScore: scoreInfo.totalScore,
          quizCount: scoreInfo.quizCount,
        };
      });

      // Sắp xếp tất cả học sinh theo điểm số giảm dần
      allStudents.sort((a, b) => b.totalScore - a.totalScore);

      // Phân trang sau khi đã sắp xếp
      const paginatedStudents = allStudents.slice(skip, skip + limit);

      // Lấy thông tin chi tiết cho học sinh đã phân trang
      const paginatedStudentIds = paginatedStudents.map((s) => s.studentId);

      // Lấy thông tin chi tiết học sinh
      const studentDetails = await User.find(
        { _id: { $in: paginatedStudentIds } },
        { _id: 1, fullName: 1, account: 1, email: 1, avatarUrl: 1 }
      );

      // Tạo map thông tin học sinh
      const studentInfoMap = {};
      studentDetails.forEach((student) => {
        studentInfoMap[student._id.toString()] = {
          fullName: student.fullName,
          account: student.account,
          email: student.email,
          avatarUrl: student.avatarUrl,
        };
      });

      // Tạo kết quả cuối cùng với ranking
      const results = paginatedStudents.map((student, index) => {
        const studentId = student.studentId.toString();
        const studentInfo = studentInfoMap[studentId] || {};

        return {
          rank: skip + index + 1,
          studentId: student.studentId,
          fullName: studentInfo.fullName || "Unknown",
          account: studentInfo.account || "Unknown",
          email: studentInfo.email || "Unknown",
          avatarUrl: studentInfo.avatarUrl || null,
          totalScore: student.totalScore,
          quizCount: student.quizCount,
        };
      });

      // Lấy tổng số học sinh để tính pagination
      const totalItems = allStudentIds.length;
      const totalPages = Math.ceil(totalItems / limit);

      res.status(200).json({
        results,
        pagination: {
          totalItems,
          totalPages,
          currentPage: page,
          pageSize: limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // [GET] /student-answer/:classroomId/student/:studentId - Get student quiz details (only for classroom owner)
  async getStudentQuizDetails(req, res, next) {
    try {
      const userId = req.user.id;
      const { classroomId, studentId } = req.params;

      // Pagination parameters
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      const classroom = await Classroom.findById(classroomId);
      if (!classroom) {
        return res.status(404).json({ message: "Classroom not found" });
      }

      // Check xem current user có phải là chủ lớp không
      const isOwner = classroom.userId.equals(userId);
      if (!isOwner) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Kiểm tra xem lớp có student đó không
      const isStudentInClass = classroom.students.includes(studentId);
      if (!isStudentInClass) {
        return res
          .status(404)
          .json({ message: "Student not found in this classroom" });
      }

      // Lấy thông tin chi tiết student
      const student = await User.findById(studentId, {
        fullName: 1,
        account: 1,
        email: 1,
        avatartUrl: 1,
      });
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }

      // Lấy tất cả classroom quizzes trong classroom
      const classroomQuizzes = await ClassroomQuiz.find({
        classroomId,
      }).populate("quizId", "quizName");

      const classroomQuizIds = classroomQuizzes.map((quiz) => quiz._id);

      // Tạo map cho quiz details để dùng sau
      const quizDetailsMap = {};
      classroomQuizzes.forEach((quiz) => {
        quizDetailsMap[quiz._id.toString()] = {
          quizId: quiz.quizId._id,
          quizName: quiz.quizId.quizName,
          classroomQuizId: quiz._id,
        };
      });

      // Sử dụng aggregate để lấy dữ liệu student answers có phân trang
      const studentAnswersAggregate = await StudentAnswer.aggregate([
        {
          // Lọc theo điều kiện
          $match: {
            classroomQuizId: { $in: classroomQuizIds },
            studentId: new mongoose.Types.ObjectId(studentId),
            status: { $in: ["disconnected", "submitted", "graded"] },
          },
        },
        {
          // Sắp xếp theo thời gian nộp giảm dần
          $sort: { submittedAt: -1 },
        },
        {
          // Phân trang và đếm tổng số kết quả
          $facet: {
            metadata: [{ $count: "totalItems" }],
            data: [{ $skip: skip }, { $limit: limit }],
          },
        },
      ]);

      const metadata = studentAnswersAggregate[0].metadata[0] || {
        totalItems: 0,
      };
      const studentAnswerData = studentAnswersAggregate[0].data;
      const totalItems = metadata.totalItems;
      const totalPages = Math.ceil(totalItems / limit);

      // Lấy thông tin quiz cho từng student answer
      const quizResults = studentAnswerData.map((answer) => {
        const quizDetails = quizDetailsMap[answer.classroomQuizId.toString()];
        return {
          studentAnswerId: answer._id,
          quizId: quizDetails ? quizDetails.quizId : null,
          quizName: quizDetails ? quizDetails.quizName : "Unknown Quiz",
          score: answer.score || 0,
          totalScore: answer.quizTotalScore || 0,
          status: answer.status,
          startedAt: answer.startedAt,
          endedAt: answer.endedAt,
          submittedAt: answer.submittedAt,
        };
      });

      res.status(200).json({
        student: {
          id: student._id,
          fullName: student.fullName,
          account: student.account,
          email: student.email,
          avatarUrl: student.avatarUrl,
        },
        quizzes: quizResults,
        pagination: {
          totalItems,
          totalPages,
          currentPage: page,
          pageSize: limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new StudentAnswerController();
