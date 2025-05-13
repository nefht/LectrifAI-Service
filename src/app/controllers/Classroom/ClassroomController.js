const { ObjectId } = require("mongoose").Types;
const { v4: uuidv4 } = require("uuid");
const Classroom = require("../../models/Classroom/Classroom");
const ClassroomLectureVideo = require("../../models/Classroom/ClassroomLectureVideo");
const ClassroomQuiz = require("../../models/Classroom/ClassroomQuiz");
const User = require("../../models/User");
const StudentAnswer = require("../../models/Classroom/StudentAnswer");

class ClassroomController {
  // [GET] /classroom - Get user's own classrooms
  async getAllClassrooms(req, res, next) {
    try {
      const userId = req.user.id;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      const { search, sortBy = "createdAt", order = "desc" } = req.query;

      const filter = { userId };
      if (search) {
        filter.classroomName = { $regex: search, $options: "i" };
      }

      // Tạo sort object
      const sort = {};
      sort[sortBy] = order === "asc" ? 1 : -1;

      const classrooms = await Classroom.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit);

      const total = await Classroom.countDocuments(filter);
      const totalPages = Math.ceil(total / limit);

      res.status(200).json({
        data: classrooms,
        pagination: {
          total,
          page,
          limit,
          totalPages,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // [GET] /classroom/added - Get classrooms added by other users
  async getAddedClassrooms(req, res, next) {
    try {
      const userId = req.user.id;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      const { search, sortBy = "createdAt", order = "desc" } = req.query;

      const filter = {
        students: { $in: userId },
      };

      if (search) {
        filter.$or = [
          { classroomName: { $regex: search, $options: "i" } },
          { "userId.fullName": { $regex: search, $options: "i" } },
          { "userId.account": { $regex: search, $options: "i" } },
        ];
      }

      // Tạo sort object
      const sort = {};
      sort[sortBy] = order === "asc" ? 1 : -1;

      const classrooms = await Classroom.find(filter)
        .populate("userId", "fullName account email avatarUrl")
        .sort(sort)
        .skip(skip)
        .limit(limit);

      const total = await Classroom.countDocuments(filter);
      const totalPages = Math.ceil(total / limit);

      res.status(200).json({
        data: classrooms,
        pagination: {
          total,
          page,
          limit,
          totalPages,
        },
      });
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

      // Tạo unique token cho lớp học
      const inviteToken = uuidv4();

      const classroom = await Classroom.create({
        classroomName,
        userId,
        inviteToken,
      });

      // Tạo link mời tham gia lớp học
      const inviteLink = `${process.env.CLIENT_URL}/classroom/join/${inviteToken}`;

      res.status(200).json({ classroom, inviteLink });
    } catch (error) {
      next(error);
    }
  }

  // [PUT] /classroom/reset-invite/:id - Reset inviteToken
  async resetInviteToken(req, res, next) {
    try {
      const userId = req.user.id;
      const classroomId = req.params.id;

      const classroom = await Classroom.findOne({
        _id: classroomId,
        userId,
      });

      console.log(classroom);

      if (!classroom) {
        return res.status(404).json({ message: "Classroom not found" });
      }

      const newInviteToken = uuidv4();
      classroom.inviteToken = newInviteToken;
      await classroom.save();

      const inviteLink = `${process.env.CLIENT_URL}/classroom/join/${newInviteToken}`;

      res.status(200).json({ classroom, inviteLink });
    } catch (error) {
      next(error);
    }
  }

  // [GET] /classroom/invite/:inviteToken - Get classroom information by invite token
  async getClassroomByInviteToken(req, res, next) {
    try {
      const inviteToken = req.params.inviteToken;

      const classroom = await Classroom.findOne({ inviteToken });
      if (!classroom) {
        return res.status(404).json({ message: "Classroom not found" });
      }

      res.status(200).json({
        classroomName: classroom.classroomName,
        numberOfStudents: classroom.students.length,
      });
    } catch (error) {
      next(error);
    }
  }

  // [GET] /classroom/join/:inviteToken - Join classroom by invite link
  async joinClassroomByInvite(req, res, next) {
    try {
      const userId = req.user.id;
      const inviteToken = req.params.inviteToken;

      const classroom = await Classroom.findOne({ inviteToken });

      if (!classroom) {
        return res.status(404).json({ message: "Classroom not found" });
      }

      if (!classroom.students.includes(userId)) {
        classroom.students.push(userId);
        await classroom.save();
      }

      if (classroom.userId.equals(userId)) {
        return res.status(400).json({
          message: "You are already the owner of this classroom",
        });
      }

      res.status(200).json({
        message: "Successfully joined the classroom",
        classroom,
      });
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

      const classroom = await Classroom.findOne({
        _id: classroomId,
        userId,
      });

      if (!classroom) {
        return res.status(404).json({ message: "Classroom not found" });
      }

      // Tìm tất cả ClassroomQuiz liên quan đến Classroom
      const classroomQuizzes = await ClassroomQuiz.find({ classroomId });

      // Xóa tất cả StudentAnswer liên quan đến ClassroomQuiz
      await StudentAnswer.deleteMany({
        classroomQuizId: {
          $in: classroomQuizzes.map((quiz) => quiz._id),
        },
      });

      await ClassroomQuiz.deleteMany({
        classroomId,
      });

      await ClassroomLectureVideo.deleteMany({
        classroomId,
      });

      await Classroom.deleteOne({ _id: classroomId });

      res.status(200).json(classroom);
    } catch (error) {
      next(error);
    }
  }

  // [GET] /classroom/students/:id
  async getStudentsInClassroom(req, res, next) {
    try {
      const userId = req.user.id;
      const classroomId = req.params.id;

      // Pagination parameters
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      // Search parameters
      const searchQuery = req.query.search || "";

      // Sort parameters
      const sortField = req.query.sortField || "fullName";
      const sortOrder = req.query.sortOrder === "desc" ? -1 : 1;
      const sortOptions = {};
      sortOptions[sortField] = sortOrder;

      const classroom = await Classroom.findById(classroomId).populate(
        "userId",
        "fullName"
      );

      if (!classroom) {
        return res.status(404).json({ message: "Classroom not found" });
      }

      // Kiểm tra quyền truy cập của người dùng
      if (
        !classroom.students.some(
          (student) => student._id.toString() === userId
        ) &&
        !classroom.userId._id.equals(userId)
      ) {
        return res.status(403).json({
          message: "You are not allowed to access this classroom",
        });
      }

      // Tạo search condition
      const searchCondition = searchQuery
        ? {
            _id: { $in: classroom.students },
            $or: [
              { fullName: { $regex: searchQuery, $options: "i" } },
              { email: { $regex: searchQuery, $options: "i" } },
              { account: { $regex: searchQuery, $options: "i" } },
            ],
          }
        : { _id: { $in: classroom.students } };

      // Lấy total count
      const totalStudents = await User.countDocuments(searchCondition);

      // Paginate, filter, sort
      const students = await User.find(searchCondition)
        .select("fullName account email avatarUrl")
        .sort(sortOptions)
        .skip(skip)
        .limit(limit);

      res.status(200).json({
        students,
        classroom,
        pagination: {
          total: totalStudents,
          page,
          limit,
          totalPages: Math.ceil(totalStudents / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // [PUT] /classroom/remove-students/:id
  async removeStudentFromClassroom(req, res, next) {
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

      const updatedStudents = classroom.students.filter(
        (student) => !studentIds.includes(String(student._id))
      );

      classroom.students = updatedStudents;
      await classroom.save();

      res.status(200).json(classroom);
    } catch (error) {
      next(error);
    }
  }

  // [PATCH] /classroom/:id - Rename classroom
  async renameClassroom(req, res, next) {
    try {
      const userId = req.user.id;
      const classroomId = req.params.id;
      const { classroomName } = req.body;

      const classroom = await Classroom.findOneAndUpdate(
        { _id: classroomId, userId },
        { classroomName },
        { new: true }
      );

      if (!classroom) {
        return res.status(404).json({ message: "Classroom not found" });
      }

      res.status(200).json(classroom);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ClassroomController();
