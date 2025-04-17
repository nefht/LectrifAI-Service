const { ObjectId } = require("mongoose").Types;
const Classroom = require("../../models/Classroom/Classroom");
const ClassroomLectureVideo = require("../../models/Classroom/ClassroomLectureVideo");
const ClassroomQuiz = require("../../models/Classroom/ClassroomQuiz");

class ClassroomController {
  // [GET] /classroom - Get user's own classrooms
  async getAllClassrooms(req, res, next) {
    try {
      const userId = req.user.id;
      const classrooms = await Classroom.find({ userId });

      res.status(200).json(classrooms);
    } catch (error) {
      next(error);
    }
  }

  // [GET] /classroom/added - Get classrooms added by other users
  async getAddedClassrooms(req, res, next) {
    try {
      const userId = req.user.id;
      const classrooms = await Classroom.find({ students: { $in: userId } });

      res.status(200).json(classrooms);
    } catch (error) {
      next(error);
    }
  }

  // [GET] /classroom/students/:id - Get students in a classroom
  async getStudentsInClassroom(req, res, next) {
    try {
      const userId = req.user.id;
      const classroomId = req.params.id;

      const classroom = await Classroom.findById(classroomId).populate(
        "students",
        "fullName account email"
      );

      if (!classroom) {
        return res.status(404).json({ message: "Classroom not found" });
      }

      // Kiểm tra quyền truy cập của người dùng
      if (
        !classroom.students.some(
          (student) => student._id.toString() === userId
        ) &&
        !classroom.userId.equals(userId)
      ) {
        return res.status(403).json({
          message: "You are not allowed to access this classroom",
        });
      }

      res.status(200).json(classroom.students);
    } catch (error) {
      next(error);
    }
  }

  // [GET] /classroom/:id
  async getClassroomById(req, res, next) {
    try {
      const userId = req.user.id;
      const classroomId = req.params.id;

      const classroom = await Classroom.findById(classroomId).populate(
        "userId",
        "fullName account email"
      );

      if (!classroom) {
        return res.status(404).json({ message: "Classroom not found" });
      }

      // Kiểm tra quyền truy cập của người dùng
      if (
        !classroom.students.includes(userId) &&
        !classroom.userId.equals(userId)
      ) {
        return res.status(403).json({
          message: "You are not allowed to access this classroom",
        });
      }

      res.status(200).json(classroom);
    } catch (error) {
      next(error);
    }
  }

  // [GET] /classroom/materials/:id
  async getClassroomMaterials(req, res, next) {
    try {
      const classroomId = req.params.id;

      const classroomQuizzes = await ClassroomQuiz.find({ classroomId })
        .populate("quizId", "quizName")
        .sort({ createdAt: -1 });
      const classroomLectures = await ClassroomLectureVideo.find({
        classroomId,
      })
        .populate("lectureVideoId", "lectureName")
        .sort({ createdAt: -1 });

      const materials = [...classroomQuizzes, ...classroomLectures];

      materials.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

      res.status(200).json(materials);
    } catch (error) {
      next(error);
    }
  }

  // [POST] /classroom
  async createClassroom(req, res, next) {
    try {
      const userId = req.user.id;
      const { classroomName } = req.body;

      const classroom = await Classroom.create({
        classroomName,
        userId,
      });

      res.status(200).json(classroom);
    } catch (error) {
      next(error);
    }
  }

  // [PUT] /classroom/students/:id
  async addStudentsToClassroom(req, res, next) {
    try {
      const userId = req.user.id;
      const classroomId = req.params.id;
      const { studentIds } = req.body;

      const classroom = await Classroom.findOne({
        _id: classroomId,
        userId,
      });

      if (!classroom) {
        return res.status(404).json({ message: "Classroom not found" });
      }

      // Chuyển ids từ object -> string để loại bỏ trùng lặp
       classroom.students = [
         ...new Set([
           ...classroom.students.map((id) => String(id)),
           ...studentIds,
         ]),
       ];
       
      await classroom.save();

      res.status(200).json(classroom);
    } catch (error) {
      next(error);
    }
  }

  // [POST] /classroom/quizzes/:id
  async addQuizzesToClassroom(req, res, next) {
    try {
      const userId = req.user.id;
      const classroomId = req.params.id;
      const { quizzes } = req.body;

      const classroom = await Classroom.findOne({
        _id: classroomId,
        userId,
      });

      if (!classroom) {
        return res.status(404).json({ message: "Classroom not found" });
      }

      const classroomQuizzes = quizzes.map((quiz) => {
        return {
          classroomId,
          quizId: quiz.quizId,
          startTime: quiz.startTime,
          endTime: quiz.endTime,
          duration: quiz.duration,
        };
      });

      await ClassroomQuiz.insertMany(classroomQuizzes);

      res.status(200).json(classroomQuizzes);
    } catch (error) {
      next(error);
    }
  }

  // [POST] /classroom/lectures/:id
  async addLecturesToClassroom(req, res, next) {
    try {
      const userId = req.user.id;
      const classroomId = req.params.id;
      const { lectureVideos } = req.body;

      const classroom = await Classroom.findOne({
        _id: classroomId,
        userId,
      });

      if (!classroom) {
        return res.status(404).json({ message: "Classroom not found" });
      }

      const classroomLectures = lectureVideos.map((lecture) => {
        return {
          classroomId,
          lectureVideoId: lecture.lectureVideoId,
          lectureScriptId: lecture.lectureScriptId,
        };
      });

      await ClassroomLectureVideo.insertMany(classroomLectures);

      res.status(200).json(classroomLectures);
    } catch (error) {
      next(error);
    }
  }

  // [DELETE] /classroom/:id
  async deleteClassroom(req, res, next) {
    try {
      const userId = req.user.id;
      const classroomId = req.params.id;

      const classroom = await Classroom.findOneAndDelete({
        _id: classroomId,
        userId,
      });

      if (!classroom) {
        return res.status(404).json({ message: "Classroom not found" });
      }

      await ClassroomQuiz.deleteMany({
        classroomId,
      });

      await ClassroomLectureVideo.deleteMany({
        classroomId,
      });

      res.status(200).json(classroom);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ClassroomController();
