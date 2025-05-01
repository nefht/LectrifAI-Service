const express = require("express");
const cors = require("cors");
const http = require("http");
const socketIo = require("socket.io");

const db = require("./config/db");
const route = require("./routes");
const errorHandler = require("./app/middleware/errorHandlingMiddleware");
const studentAnswerSocket = require("./app/socket/studentAnswerSocket");
const quizRoomSocket = require("./app/socket/quizRoomSocket");
const { authenticateSocket } = require("./app/middleware/authMiddleware");

const app = express();
const port = process.env.PORT || 3000;

// Khởi tạo WebSocket server
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL, // URL của frontend
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
    credentials: true, // Cho phép gửi cookies nếu cần thiết
  },
});

// Connect to DB
db.connect();

// Global middlewares (Application-level)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Routes init
route(app);

io.use(authenticateSocket);

// WebSocket event handling
io.on("connection", (socket) => {
  console.log("A user connected");

  // Sử dụng các sự kiện WebSocket
  studentAnswerSocket(socket);
  quizRoomSocket(io, socket);

  // Khi client ngắt kết nối
  socket.on("disconnect", () => {
    console.log("A user disconnected");
  });
});

// Error handling middleware
app.use(errorHandler);

server.listen(port, async function () {
  console.log("App listening on port: " + port);
});
