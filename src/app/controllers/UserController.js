const User = require("../models/User");
const Profile = require("../models/Profile");
const { deleteFileFromS3 } = require("../../utils/aws-s3");

class UserController {
  // [GET] /user
  async getAllUsers(req, res, next) {
    try {
      const { search } = req.query;
      const userId = req.user.id;

      const searchConditions = search
        ? {
            $or: [
              { fullName: { $regex: search, $options: "i" } },
              { email: { $regex: search, $options: "i" } },
              { account: { $regex: search, $options: "i" } },
            ],
          }
        : {};

      const users = await User.find(searchConditions).populate("profile");

      const responseData = users
        .filter((user) => user._id.toString() !== userId)
        .map((user) => ({
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          account: user.account,
          avatarUrl: user.avatarUrl,
          profile: user.profile,
        }));

      res.status(200).json(responseData);
    } catch (error) {
      next(error);
    }
  }

  // [GET] /user/:id
  async getUserById(req, res, next) {
    const userId = req.user.id;
    const { id } = req.params;
    try {
      console.log(userId);
      // Tìm user
      const user = await User.findById(id).populate("profile");
      if (!user) {
        return res.status(404).json({ error: "User not found." });
      }

      // Nếu profile là null, tìm profile theo userId
      if (!user.profile) {
        const profile = await Profile.findOne({ userId: id });
        if (profile) {
          user.profile = profile;

          // Update profile id
          await User.findByIdAndUpdate(id, { profile: profile._id });
        }
      }

      let profileData;
      if (user.profile) {
        if (user.profile.isPublic || userId.toString() === id.toString()) {
          profileData = user.profile;
        } else {
          profileData = null;
        }
      }

      if (userId !== id) {
        res.json({
          _id: user._id,
          fullName: user.fullName,
          email: user.email,
          account: user.account,
          avatarUrl: user.avatarUrl,
          createdAt: user.createdAt,
          profile: profileData,
        });
      } else {
        res.status(200).json(user);
      }
    } catch (error) {
      next(error);
    }
  }

  // [PUT] /user
  async updateUser(req, res, next) {
    const userId = req.user.id;
    try {
      const { avatarUrl, email, ...userData } = req.body;
      // Kiểm tra nếu có email mới và email đó đã tồn tại chưa
      if (email) {
        const existingUser = await User.findOne({ email });
        if (existingUser && existingUser._id.toString() !== userId) {
          return res.status(400).json({ error: "Email already exists." });
        }
      }

      const updatedUser = await User.findByIdAndUpdate(userId, userData, {
        new: true,
      }).populate("profile");

      if (!updatedUser) {
        return res.status(404).json({ error: "User not found." });
      }
      res.status(200).json(updatedUser);
    } catch (error) {
      next(error);
    }
  }

  // [DELETE] /user/:id (Soft delete)
  async softDeleteUser(req, res, next) {
    const userId = req.user.id;
    try {
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found." });
      }
      user.deletedAt = new Date();
      await user.save();
      res.status(200).json({
        message: "User marked for deletion. Can be restored within 10 days.",
      });
    } catch (error) {
      next(error);
    }
  }

  // [PATCH] /user/:id/restore
  async restoreUser(req, res, next) {
    try {
      const user = await User.findOne({
        _id: req.params.id,
        deletedAt: { $ne: null },
      });
      if (!user) {
        return res
          .status(404)
          .json({ error: "User not found or already active." });
      }
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
      if (user.deletedAt < tenDaysAgo) {
        return res
          .status(400)
          .json({ error: "Restore period expired, user permanently deleted." });
      }
      user.deletedAt = null;
      await user.save();
      res.status(200).json({ message: "User restored successfully." });
    } catch (error) {
      next(error);
    }
  }

  // [DELETE] /user/:id/permanent (Admin Only)
  async permanentlyDeleteUser(req, res, next) {
    try {
      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found." });
      }
      if (user.profile) {
        await Profile.findByIdAndDelete(user.profile);
      }
      await User.findByIdAndDelete(user._id);
      res.status(200).json({ message: "User permanently deleted by admin." });
    } catch (error) {
      next(error);
    }
  }

  // [GET] /user/profile/:userId
  async getUserProfile(req, res, next) {
    const userId = req.user.id;
    const id = req.params.userId;
    try {
      const profile = await Profile.findOne({ userId: id }).populate("userId");

      if (profile?.isPublic || userId.toString() === id.toString()) {
        return profile ? res.status(200).json(profile) : res.json({});
      } else {
        return res.status(403).json({
          error: "Profile is private. Access denied.",
        });
      }
    } catch (error) {
      next(error);
    }
  }

  // [PUT] /user/profile
  async updateUserProfile(req, res, next) {
    const userId = req.user.id;
    const userProfile = req.body;
    try {
      const updatedProfile = await Profile.findOneAndUpdate(
        { userId },
        userProfile,
        {
          new: true,
        }
      );
      if (!updatedProfile) {
        const newProfile = new Profile({ userId, ...userProfile });
        await newProfile.save();

        res.json(newProfile);
      } else {
        res.status(200).json(updatedProfile);
      }
    } catch (error) {
      next(error);
    }
  }

  // [POST] /avatar
  async uploadAvater(req, res, next) {
    try {
      const userId = req.user.id;
      const avatarUrl = req.file.location;
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { avatarUrl: avatarUrl },
        { new: true }
      );

      res.json(updatedUser);
    } catch (error) {
      next(error);
    }
  }

  // [POST] /avatar
  async deleteAvatar(req, res, next) {
    try {
      const userId = req.user.id;
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found." });
      }
      if (user.avatarUrl === null) {
        return res.status(400).json({ error: "No avatar to delete." });
      }
      // Xóa avatar từ S3
      await deleteFileFromS3(user.avatarUrl);
      // Cập nhật avatarUrl trong cơ sở dữ liệu
      user.avatarUrl = null;
      await user.save();

      res.json(user);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new UserController();
