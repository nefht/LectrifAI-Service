const { ObjectId } = require("mongoose").Types;
const { MongoClient } = require("mongodb");
const StudentAnswer = require("../models/Classroom/StudentAnswer");
const { checkShortAnswer } = require("../../utils/google-ai");

const client = new MongoClient(process.env.DATABASE_URI);
const StudentAnswerCollection = client
  .db("LectrifAI")
  .collection("studentanswers");

const studentAnswerSocket = (socket) => {
  // Lắng nghe sự kiện 'update-answer' từ client
  socket.on("update-answer", async (data) => {
    const userId = socket.userId;
    const { studentAnswerId, questionIndex, userAnswer } = data;

    try {
      const studentAnswer = await StudentAnswerCollection.findOne({
        _id: new ObjectId(studentAnswerId),
        studentId: new ObjectId(userId),
      });

      if (!studentAnswer) {
        socket.emit("error", { message: "Student answer not found" });
        return;
      }

      if (questionIndex !== -1) {
        await StudentAnswerCollection.updateOne(
          { _id: new ObjectId(studentAnswerId) },
          {
            $set: {
              [`userAnswers.${questionIndex}.userAnswer`]: userAnswer,
            },
          }
        );

        const endedAt = studentAnswer.endedAt;

        // Phát sự kiện 'answer-updated' tới client thông báo đã cập nhật
        socket.emit("answer-updated", {
          message: "Answer updated successfully",
          questionIndex,
          userAnswer,
          endedAt,
        });
      } else {
        socket.emit("error", { message: "Question not found" });
      }
    } catch (error) {
      socket.emit("error", { message: error.message });
    }
  });

  socket.on("disconnect", async () => {
    const userId = socket.userId;

    try {
      // Tìm tất cả bài làm của học sinh có trạng thái 'in-progress'
      const studentAnswers = await StudentAnswer.find({
        studentId: userId,
        status: "in-progress",
      });

      // Nếu học sinh có bài thi đang trong trạng thái 'in-progress'
      if (studentAnswers.length > 0) {
        // Duyệt qua tất cả bài thi
        const currentTime = Date.now();
        for (const studentAnswer of studentAnswers) {
          if (studentAnswer.status === "in-progress") {
            // Nếu bài thi vẫn chưa hết thời gian, cập nhật trạng thái là 'disconnected'
            if (!student.endedAt || studentAnswer.endedAt > currentTime) {
              studentAnswer.status = "disconnected";
            } else {
              studentAnswer.status = "graded";
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
                  feedback = JSON.parse(
                    rawText.replace(/```json|```/g, "").trim()
                  );
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
            studentAnswer.submittedAt = currentTime;

            await studentAnswer.save();
            console.log(
              `Student answer marked as disconnected for student ${userId}`
            );
          }
        }
      }
    } catch (error) {
      console.error("Error on disconnect:", error);
    }
  });
};

module.exports = studentAnswerSocket;
