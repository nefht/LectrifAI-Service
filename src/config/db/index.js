// Import thư viện mongoose
const mongoose = require("mongoose");

const DATABASE_URI =
  process.env.DATABASE_URI || "mongodb://localhost:27017/LectrifAI";

async function connect() {
  try {
    await mongoose.connect(DATABASE_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connect successfully!");
  } catch (error) {
    console.log("Connection failed!");
  }
}

module.exports = { connect };
