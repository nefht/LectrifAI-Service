const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.LECTRIFAI_EMAIL,
    pass: process.env.LECTRIFAI_PASSWORD,
  },
});

module.exports = { transporter };
