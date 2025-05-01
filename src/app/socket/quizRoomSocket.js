const { MongoClient, ObjectId } = require("mongodb");

const client = new MongoClient(process.env.DATABASE_URI);
const QuizRoomCollection = client
  .db("LectrifAI")
  .collection("multiplequizrooms");

const quizRoomSocket = (io, socket) => {
  // Lắng nghe sự kiện khi người dùng muốn join vào một socket room
  socket.on("join-socket-room", async ({ roomId }) => {
    if (!roomId) return;

    try {
      const roomIdStr = roomId.toString();
      const roomObjectId =
        typeof roomId === "string" && roomId.length === 24
          ? new ObjectId(roomId)
          : roomId;

      // Join vào socket room
      socket.join(roomIdStr);
      console.log(`User ${socket.userId} joined socket room ${roomIdStr}`);

      const quizRoom = await QuizRoomCollection.findOne({ _id: roomObjectId });

      if (quizRoom) {
        socket.emit("quiz-room-state", quizRoom);
      }

      // Có thể thông báo cho người dùng biết đã join thành công nếu cần
      socket.emit("socket-room-joined", { roomId: roomIdStr });
    } catch (error) {
      console.error("Error joining socket room:", error);
    }
  });

  // Thêm sự kiện để client yêu cầu trạng thái hiện tại của phòng
  socket.on("request-room-state", async ({ roomId }) => {
    if (!roomId) return;

    try {
      const roomObjectId =
        typeof roomId === "string" && roomId.length === 24
          ? new ObjectId(roomId)
          : roomId;

      const quizRoom = await QuizRoomCollection.findOne({ _id: roomObjectId });

      if (quizRoom) {
        socket.emit("quiz-room-state", quizRoom);
      } else {
        socket.emit("error", { message: "Room not found" });
      }
    } catch (error) {
      console.error("Error fetching room state:", error);
      socket.emit("error", { message: "Failed to get room state" });
    }
  });

  // Lắng nghe sự kiện 'join-quiz-room' từ client
  socket.on("join-quiz-room", async (data) => {
    const { inviteToken, user } = data; // Nhận inviteToken từ client
    const userId = socket.userId;

    try {
      // Kiểm tra xem quizRoom có tồn tại trong cơ sở dữ liệu không
      const quizRoom = await QuizRoomCollection.findOne({ inviteToken });

      if (!quizRoom) {
        socket.emit("error", { message: "Quiz room not found" });
        return;
      }

      const roomIdStr = quizRoom._id.toString();

      // Tạo object chứa thông tin người chơi đầy đủ
      const playerInfo = {
        userId: userId,
        account: user.account,
        fullName: user.fullName,
      };

      // Kiểm tra xem người dùng đã tham gia phòng chưa
      const existingPlayer = quizRoom.players.find(
        (player) => player.userId.toString() === userId.toString()
      );

      if (!existingPlayer) {
        // Người dùng chưa tham gia - thêm vào database
        await QuizRoomCollection.updateOne(
          { _id: quizRoom._id },
          { $push: { players: playerInfo } }
        );
        console.log(
          `New player ${playerInfo.account} added to room ${roomIdStr}`
        );

        // Lấy room đã update để có danh sách player mới nhất
        const updatedQuizRoom = await QuizRoomCollection.findOne({
          _id: quizRoom._id,
        });

        // Phát sự kiện 'quiz-room-updated' đến tất cả các client trong phòng
        io.to(roomIdStr).emit("quiz-room-updated", {
          newPlayer: playerInfo,
          players: updatedQuizRoom.players,
        });
      } else {
        // Người dùng đã tham gia rồi - không thêm lại vào database
        console.log(
          `Player ${playerInfo.account} already in room ${roomIdStr} - just joining socket room`
        );

        // Vẫn gửi trạng thái phòng hiện tại cho client
        socket.emit("quiz-room-state", quizRoom);
      }

      // Tham gia vào phòng socket (dù đã tham gia database hay chưa)
      socket.join(roomIdStr);

      // Phát sự kiện 'joined-quiz-room' đến client để thông báo đã tham gia thành công
      socket.emit("joined-quiz-room", {
        message: "Joined quiz room successfully",
        roomId: roomIdStr,
      });
    } catch (error) {
      console.error("Error joining quiz room:", error);
      socket.emit("error", { message: error.message });
    }
  });
};

module.exports = quizRoomSocket;
