const authRouter = require("./auth");
const userRouter = require("./user");
const uploadedFileRouter = require("./uploaded-file");
const slideContentRouter = require("./slide-content");
const uploadedSlideRouter = require("./uploaded-slide");
const lectureScriptRouter = require("./lecture-script");
const lectureVideoRouter = require("./lecture-video");
const notebookRouter = require("./notebook");
const chatMessageRouter = require("./chat-message");
const instantLectureRouter = require("./instant-lecture");
const quizRouter = require("./quiz");
const classroomRouter = require("./classroom/classroom");
const classroomQuizRouter = require("./classroom/classroom-quiz");
const classroomLectureVideoRouter = require("./classroom/classroom-lecture-video");
const studentAnswerRouter = require("./classroom/student-answer");
const helpersRouter = require("./helpers");

function route(app) {
  app.use("/auth", authRouter);
  app.use("/user", userRouter);
  app.use("/uploaded-file", uploadedFileRouter);
  app.use("/slide-content", slideContentRouter);
  app.use("/uploaded-slide", uploadedSlideRouter);
  app.use("/lecture-script", lectureScriptRouter);
  app.use("/lecture-video", lectureVideoRouter);
  app.use("/notebook", notebookRouter);
  app.use("/chat-message", chatMessageRouter);
  app.use("/instant-lecture", instantLectureRouter);
  app.use("/quiz", quizRouter);
  app.use("/classroom", classroomRouter);
  app.use("/classroom-quiz", classroomQuizRouter);
  app.use("/classroom-lecture", classroomLectureVideoRouter);
  app.use("/student-answer", studentAnswerRouter);
  app.use("/helpers", helpersRouter);
}

module.exports = route;
