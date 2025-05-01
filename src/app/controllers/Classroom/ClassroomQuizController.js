const { ObjectId } = require("mongoose").Types;
const ClassroomQuiz = require("../../models/Classroom/ClassroomQuiz");
const Quiz = require("../../models/Quiz");

class ClassroomQuizController {
  // [GET] /classroom-quiz/:id - Get quiz by ID
  async getClassroomQuizById(req, res, next) {
    try {
      const userId = req.user.id;
      const userObjectId = new ObjectId(userId);
      const classroomQuizId = req.params.id;
      const { quizId } = req.body;

      const classroomQuiz = await ClassroomQuiz.findOne({
        _id: classroomQuizId,
        quizId,
      }).populate("classroomId", "userId students");

      if (!classroomQuiz) {
        return res
          .status(404)
          .json({ message: "Classroom quiz material not found" });
      }

      if (
        !classroomQuiz.classroomId.students.includes(userObjectId) &&
        !userObjectId.equals(classroomQuiz.classroomId.userId)
      ) {
        return res.status(403).json({
          message: "You are not allowed to access this quiz material",
        });
      }

      const quizDetail = await Quiz.findById(quizId);

      if (!quizDetail) {
        return res.status(404).json({ message: "Quiz not found" });
      }

      const quizQuestions = quizDetail.quizData.quizzes.map((quiz) => {
        return {
          questionType: quiz.questionType,
          question: quiz.question,
          options: quiz.options,
          points: quiz.points,
        };
      });

      let responseData;
      if (userId === classroomQuiz.userId || userId === quizDetail.userId) {
        responseData = {
          ...classroomQuiz._doc,
          ...quizDetail,
        };
      } else {
        responseData = {
          ...classroomQuiz._doc,
          quizName: quizDetail.quizName,
          quizData: {
            quizzes: quizQuestions,
          },
        };
      }

      res.status(200).json(responseData);
    } catch (error) {
      next(error);
    }
  }

  // [DELETE] /classroom-quiz/:id - Delete quiz by ID
  async deleteClassroomQuizById(req, res, next) {
    try {
      const userId = req.user.id;
      const classroomQuizId = req.params.id;
      const classroomQuiz = await ClassroomQuiz.findById(classroomQuizId).populate(
        "classroomId",
        "userId"
      );

      if (!classroomQuiz) {
        return res
          .status(404)
          .json({ message: "Classroom quiz material not found" });
      }

      if (userId !== classroomQuiz.classroomId.userId.toString()) {
        return res.status(403).json({
          message: "You are not allowed to access this quiz material",
        });
      }

      await ClassroomQuiz.deleteOne({ _id: classroomQuizId });

      res.status(200).json({ message: "Classroom quiz deleted successfully" });
    } catch (error) {
      next(error);
    }
  }

  // [PUT] /classroom-quiz/:id - Update classroom quiz by ID
  async updateClassroomQuizById(req, res, next) {
    try {
      const userId = req.user.id;
      const classroomQuizId = req.params.id;
      const { startTime, endTime, duration } = req.body;

      const classroomQuiz = await ClassroomQuiz.findById(classroomQuizId).populate(
        "classroomId",
        "userId"
      );

      if (!classroomQuiz) {
        return res
          .status(404)
          .json({ message: "Classroom quiz material not found" });
      }

      if (userId !== classroomQuiz.classroomId.userId.toString()) {
        return res.status(403).json({
          message: "You are not allowed to access this quiz material",
        });
      }

      await ClassroomQuiz.updateOne(
        { _id: classroomQuizId },
        { startTime, endTime, duration }
      );

      res.status(200).json({ message: "Classroom quiz updated successfully" });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ClassroomQuizController();
