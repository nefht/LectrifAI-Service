const { checkShortAnswer } = require("../../../utils/google-ai");
const Classroom = require("../../models/Classroom/Classroom");
const ClassroomQuiz = require("../../models/Classroom/ClassroomQuiz");
const StudentAnswer = require("../../models/Classroom/StudentAnswer");
const Quiz = require("../../models/Quiz");

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
      if (duration) {
        if (currentTime > endTime) {
          return res.status(400).json({ message: "Quiz has expired" });
        } else if (currentTime < startTime) {
          return res.status(400).json({ message: "Quiz has not started yet" });
        }
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
          }
        } else if (quiz.questionType === "short answer") {
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

      const studentAnswer = await StudentAnswer.findOne({
        _id: id,
        studentId: userId,
      }).populate("classroomQuizId", "quizId");

      if (!studentAnswer) {
        return res.status(404).json({ message: "Student answer not found" });
      }

      const quiz = await Quiz.findById(studentAnswer.classroomQuizId.quizId);

      let responseData;
      if (
        studentAnswer.status === "submitted" ||
        studentAnswer.status === "graded"
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
    } catch (error) {
      next(error);
    }
  }

  // [GET] /student-answer/status/:classroomQuizId  - by studentId && classroomQuizId
  async getAnswerStatusByClassroomQuizId(req, res, next) {
    try {
      const userId = req.user.id;
      const classroomQuizId = req.params.classroomQuizId;

      console.log("userId", userId);
      console.log("classroomQuizId", classroomQuizId);

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

      res
        .status(200)
        .json({
          studentAnswerId: studentAnswer._id,
          studentAnswerStatus: studentAnswer.status,
        });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new StudentAnswerController();
