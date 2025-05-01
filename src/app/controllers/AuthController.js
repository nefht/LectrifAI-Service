const User = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { transporter } = require("../../config/nodemailer");

class AuthController {
  // [POST] /auth/register
  async register(req, res, next) {
    const { fullName, email, account, password } = req.body;
    try {
      const user = await User.findOne({
        $or: [{ email }, { account }],
      });
      if (user) {
        return res
          .status(400)
          .json({ error: "Account or Email already exists." });
      }

      // Hash password
      const saltRounds = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Create new user
      const newUser = new User({
        fullName,
        email,
        account,
        password: passwordHash,
      });
      await newUser.save();

      res.status(201).json({ message: "User registered successfully." });
    } catch (error) {
      next(error);
    }
  }

  // [POST] /auth/login
  async login(req, res, next) {
    const { account, password, rememberMe } = req.body;
    const user = await User.findOne({ account });
    if (!user) {
      return res.status(400).json({ error: "Invalid account." });
    }

    try {
      // Check password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ error: "Invalid password." });
      }

      // Create JWT token
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
        expiresIn: rememberMe ? "30d" : "1d",
      });
      res.status(200).json({
        token,
        user: {
          id: user._id,
          account: user.account,
          email: user.email,
          fullName: user.fullName,
          avatarUrl: user.avatarUrl,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // [PUT] /auth/change-password
  async changePassword(req, res, next) {
    try {
      const { oldPassword, newPassword } = req.body;
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ error: "User not found." });
      }

      // Check old password
      const isMatch = await bcrypt.compare(oldPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ error: "Invalid old password." });
      }

      // Hash new password
      const saltRounds = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(newPassword, saltRounds);

      user.password = passwordHash;
      user.save();
      res.status(200).json({ message: "Password changed successfully." });
    } catch (error) {
      next(error);
    }
  }

  // [POST] /auth/forgot-password
  async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;
      const user = await User.findOne({
        email,
      });
      if (!user) {
        return res.status(404).json({ error: "User not found." });
      }

      // Create JWT token to reset password
      const resetToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
        expiresIn: "15m",
      });

      const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;

      const mailOptions = {
        to: user.email,
        from: process.env.EMAIL_USER,
        subject: "[LectrifAI] Password Reset Request",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
            <h2 style="color: #333;">Password Reset Request</h2>
            <p>Hi ${user.fullName},</p>
            <p>You requested to reset your password. Click the button below to reset it:</p>
            <div style="text-align: center;">
              <a href="${resetUrl}" style="background-color:rgb(174, 1, 190); color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                Reset Password
              </a>
            </div>
            <p style="margin-top: 20px;">If you did not request this, you can ignore this email.</p>
            <p>Thanks, <br><strong>LectrifAI Team</strong></p>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
      res.status(200).json({ message: "Reset password email sent." });
    } catch (error) {
      next(error);
    }
  }

  // [PUT] /auth/reset-password
  async resetPassword(req, res, next) {
    try {
      const { resetToken, newPassword } = req.body;

      // Verify JWT token
      const decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
      if (!decoded) {
        return res
          .status(400)
          .json({ error: "Invalid or expired reset token" });
      }
      const user = await User.findById(decoded.id);
      if (!user) {
        return res
          .status(404)
          .json({ error: "Invalid or expired reset token" });
      }

      // Hash new password
      const saltRounds = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(newPassword, saltRounds);
      user.password = passwordHash;
      await user.save();

      res.status(200).json({ message: "Password reset successfully." });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();
