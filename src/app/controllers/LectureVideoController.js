const { ObjectId } = require("mongoose").Types;
const LectureVideo = require("../models/LectureVideo");
const UploadedSlide = require("../models/UploadedSlide");
const LectureScript = require("../models/LectureScript");
const { createVideo } = require("../../utils/lecture-video");
const { downloadFileFromS3 } = require("../../utils/aws-s3");
const { convertPptxToPdf } = require("../../utils/libre-office");
const LectureVideoPermission = require("../models/permissions/LectureVideoPermission");
const ClassroomLectureVideo = require("../models/Classroom/ClassroomLectureVideo");

class LectureVideoController {
  // [GET] /lecture-video
  async getLectureVideos(req, res, next) {
    try {
      const userId = req.user.id;
      const userIdObject = new ObjectId(userId);
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      const {
        search,
        interactiveQuiz,
        sortBy = "createdAt",
        order = "desc",
      } = req.query;

      // Tạo filter object
      let filter = {};
      if (interactiveQuiz) filter.interactiveQuiz = interactiveQuiz;

      // Lấy các lecture video mà người dùng có quyền truy cập
      const permissions = await LectureVideoPermission.find({
        userId: userIdObject,
        permissionType: { $in: ["VIEWER", "EDITOR"] },
      }).select("lectureVideoId");

      const videoIds = permissions.map(
        (permission) => permission.lectureVideoId
      );
      filter = {
        $or: [
          { userId: userIdObject },
          { isPublic: true },
          { _id: { $in: videoIds } },
        ],
      };

      const pipeline = [
        {
          $lookup: {
            from: "lecturescripts",
            localField: "lectureScriptId",
            foreignField: "_id",
            as: "lectureScript",
          },
        },
        {
          $unwind: "$lectureScript",
        },
        {
          $match: {
            ...filter,
            ...(search
              ? {
                  $or: [
                    { lectureName: { $regex: search, $options: "i" } },
                    {
                      "lectureScript.lectureScript.lectureName": {
                        $regex: search,
                        $options: "i",
                      },
                    },
                    {
                      "lectureScript.lectureScript.slides.script": {
                        $regex: search,
                        $options: "i",
                      },
                    },
                  ],
                }
              : {}),
          },
        },
        {
          $sort: { [sortBy]: order === "asc" ? 1 : -1 },
        },
        {
          $facet: {
            data: [{ $skip: skip }, { $limit: limit }],
            totalCount: [{ $count: "count" }],
          },
        },
      ];

      const result = await LectureVideo.aggregate(pipeline);
      const videos = result[0].data || [];
      const total = result[0].totalCount[0]?.count || 0;

      return res.json({
        data: videos,
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

  // [GET] /lecture-video/:id
  async getLectureVideoById(req, res, next) {
    try {
      const userId = req.user.id;
      const videoId = req.params.id;

      const lectureVideo = await LectureVideo.findById(videoId);
      if (!lectureVideo)
        return res.status(404).json({ error: "Lecture video not found." });

      // Kiểm tra quyền truy cập
      if (!lectureVideo.isPublic) {
        const owner = lectureVideo.userId.toString() === userId;
        const permission = await LectureVideoPermission.findOne({
          userId,
          lectureVideoId: videoId,
        });

        // Lấy danh sách các lớp học được cấp quyền vào bài giảng
        const lectureClassrooms = await ClassroomLectureVideo.find({
          lectureVideoId: videoId,
        }).populate("classroomId", "students userId");

        // Kiểm tra người dùng có trong lớp học được cấp quyền bài giảng không
        const userInClassroom = lectureClassrooms.some((classroomLecture) => {
          const classroom = classroomLecture.classroomId;
          return (
            classroom.students.includes(userId) ||
            classroom.userId.toString() === userId
          );
        });

        if (!owner && !permission && !userInClassroom) {
          return res.status(403).json({ error: "Access denied." });
        }
      }

      res.status(200).json(lectureVideo);
    } catch (error) {
      next(error);
    }
  }

  // [POST] /lecture-video
  async createLectureVideo(req, res, next) {
    try {
      const userId = req.user.id;
      const { fileId, lectureScriptId, languageCode, voiceType, lectureSpeed } =
        req.body;

      // Kiểm tra file slide
      const uploadedFile = await UploadedSlide.findById(fileId);
      if (!uploadedFile) {
        return res.status(404).json({ error: "File not found." });
      }

      // Kiểm tra script đã tồn tại chưa
      const lectureScript = await LectureScript.findById(lectureScriptId);
      if (!lectureScript) {
        return res.status(404).json({ error: "Lecture script not found." });
      }

      // Tải slide từ S3
      console.log(`Đang tải file slide từ S3: ${uploadedFile.fileUrl}`);
      const fileBuffer = await downloadFileFromS3(uploadedFile.fileUrl);
      let pdfBuffer = fileBuffer;

      // Kiểm tra loại file
      const mimeType = uploadedFile.mimeType;
      if (mimeType !== "application/pdf") {
        pdfBuffer = await convertPptxToPdf(fileBuffer);
      }

      // Tạo video từ slide + script
      console.log(`Bắt đầu tạo video từ lecture script...`);
      const folder = "lecture-videos";
      const { videoUrl, quizTimestamps } = await createVideo(
        pdfBuffer,
        lectureScript.lectureScript.slides,
        folder,
        languageCode,
        voiceType,
        lectureSpeed
      );

      // Lưu video vào database
      const lectureVideo = new LectureVideo({
        userId,
        fileId,
        lectureScriptId,
        lectureName: lectureScript.lectureScript.lectureName,
        languageCode,
        voiceType,
        lectureSpeed,
        videoUrl,
        quizTimestamps,
        interactiveQuiz: lectureScript.interactiveQuiz,
      });

      await lectureVideo.save();

      const lectureVideoPermission = new LectureVideoPermission({
        userId,
        lectureVideoId: lectureVideo._id,
        lectureScriptId: lectureScript._id,
        permissionType: "OWNER",
      });

      await lectureVideoPermission.save();

      res.status(201).json(lectureVideo);
    } catch (error) {
      next(error);
    }
  }

  // [PUT] /lecture-video/:id
  async updateLectureVideo(req, res, next) {
    try {
      const userId = req.user.id;
      const videoId = req.params.id;
      const video = await LectureVideo.findOne({
        _id: videoId,
        userId,
      });
      if (!video) {
        return res.status(404).json({ error: "Lecture video not found." });
      }

      const updatedVideo = await LectureVideo.findByIdAndUpdate(
        videoId,
        { ...req.body },
        { new: true }
      );

      res.status(200).json(updatedVideo);
    } catch (error) {
      next(error);
    }
  }

  // [DELETE] /lecture-video/:id
  async deleteLectureVideo(req, res, next) {
    try {
      const userId = req.user.id;
      const videoId = req.params.id;
      const video = await LectureVideo.findOne({
        _id: videoId,
        userId,
      });
      if (!video) {
        return res.status(404).json({ error: "Lecture video not found." });
      }

      await LectureVideo.deleteOne({ _id: req.params.id });
      res.status(200).json({ message: "Lecture video deleted successfully." });
    } catch (error) {
      next(error);
    }
  }

  // [POST] /lecture-video/share/:id
  async shareLectureVideo(req, res, next) {
    try {
      const userId = req.user.id;
      const videoId = req.params.id;
      const { isPublic, sharedWith } = req.body;

      const lectureVideo = await LectureVideo.findOne({
        _id: videoId,
        userId,
      });

      if (!lectureVideo) {
        return res.status(404).json({ error: "Lecture video not found." });
      }

      const lectureScript = await LectureScript.findOne({
        _id: lectureVideo.lectureScriptId,
        userId,
      });

      if (!lectureScript) {
        return res.status(404).json({ error: "Lecture script not found." });
      }

      if (isPublic) {
        lectureVideo.isPublic = isPublic;
        lectureScript.isPublic = isPublic;

        await lectureVideo.save();
        await lectureScript.save();
      }

      if (!isPublic && sharedWith && sharedWith.length > 0) {
        for (const user of sharedWith) {
          await LectureVideoPermission.findOneAndUpdate(
            {
              userId: user.userId,
              lectureVideoId: videoId,
              lectureScriptId: lectureVideo.lectureScriptId,
            },
            { $set: { permissionType: user.permissionType } }, // Thay đổi giá trị của trường
            { upsert: true } // Tạo mới nếu không tìm thấy
          );
        }
      }

      const permissions = await LectureVideoPermission.find({
        lectureVideoId: videoId,
      }).populate("userId", "account fullName email");

      res.status(200).json({
        message: "Lecture video shared successfully.",
        lectureVideo,
        sharedWith: permissions.map((permission) => {
          return {
            userId: permission.userId._id,
            account: permission.userId.account,
            fullName: permission.userId.fullName,
            email: permission.userId.email,
            permissionType: permission.permissionType,
          };
        }),
        isPublic: lectureVideo.isPublic,
      });
    } catch (error) {
      next(error);
    }
  }

  // [GET] /lecture-video/share/:id - Lấy danh sách người dùng có quyền truy cập lecture video
  async getLectureVideoPermissions(req, res, next) {
    try {
      const userId = req.user.id;
      const videoId = req.params.id;
      const video = await LectureVideo.findOne({
        _id: videoId,
        userId,
      });
      if (!video) {
        return res.status(404).json({ error: "Lecture video not found." });
      }

      const permissions = await LectureVideoPermission.find({
        lectureVideoId: videoId,
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
}

module.exports = new LectureVideoController();
