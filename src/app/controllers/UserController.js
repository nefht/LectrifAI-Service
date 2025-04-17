const User = require("../models/User");
const Profile = require("../models/Profile");

class UserController {
  // [GET] /user
  async getAllUsers(req, res, next) {
    try {
      const users = await User.find().populate("profile");
      const responseData = users.map((user) => {
        return {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          account: user.account,
          profile: user.profile,
        };
      });
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
      const user = await User.findById(id).populate("profile");
      if (!user) {
        return res.status(404).json({ error: "User not found." });
      }
      if (userId !== id) {
        res.json({
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          account: user.account,
          profile: user.profile,
        })
      } else {
        res.status(200).json(user);
      }
    } catch (error) {
      next(error);
    }
  }

  // [PUT] /user/:id
  async updateUser(req, res, next) {
    const userId = req.user.id;
    try {
      const updatedUser = await User.findByIdAndUpdate(userId, req.body, {
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
}

module.exports = new UserController();
