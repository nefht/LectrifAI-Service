const { ObjectId } = require("mongoose").Types;
const ClassroomLectureVideo = require("../../models/Classroom/ClassroomLectureVideo");
const LectureScript = require("../../models/LectureScript");
const LectureVideo = require("../../models/LectureVideo");

class ClassroomLectureVideoController {
  // [GET] /classroom-lecture/:id - Get lecture video by ID
  async getClassroomLectureVideoById(req, res, next) {
    try {
      const userId = req.user.id;
      const userObjectId = new ObjectId(userId);
      const lectureVideoId = req.params.id;
      const classroomLectureVideo = await ClassroomLectureVideo.findOne({
        lectureVideoId,
      }).populate("classroomId", "userId students");

      if (!classroomLectureVideo) {
        return res
          .status(404)
          .json({ message: "Classroom lecture video not found" });
      }

      if (
        !classroomLectureVideo.classroomId.students.includes(userObjectId) &&
        userId !== classroomLectureVideo.classroomId.userId
      ) {
        return res.status(403).json({
          message: "You are not allowed to access this lecture video",
        });
      }

      const lectureVideo = await LectureVideo.findById(lectureVideoId);
      const lectureScript = await LectureScript.findById(
        classroomLectureVideo.lectureScriptId
      );

      res
        .status(200)
        .json({ ...lectureVideo, lectureScript: lectureScript.lectureScript });
    } catch (error) {
      next(error);
    }
  }

  // [DELETE] /classroom-lecture/:id - Delete lecture video by ID
  async deleteClassroomLectureVideoById(req, res, next) {
    try {
      const userId = req.user.id;
      const classroomLectureId = req.params.id;
      const classroomLectureVideo = await ClassroomLectureVideo.findById(
        classroomLectureId
      ).populate("classroomId", "userId");

      if (!classroomLectureVideo) {
        return res
          .status(404)
          .json({ message: "Classroom lecture video not found" });
      }

      if (userId !== classroomLectureVideo.classroomId.userId.toString()) {
        return res.status(403).json({
          message: "You are not allowed to access this lecture video",
        });
      }

      await ClassroomLectureVideo.deleteOne({ _id: classroomLectureId });

      res.status(200).json({ message: "Lecture video deleted successfully" });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ClassroomLectureVideoController();
