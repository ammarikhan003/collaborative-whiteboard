const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Connect to MongoDB
mongoose
  .connect("mongodb://localhost:27017/collaborative-whiteboard", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log(err));

// Create HTTP server and socket.io instance
const server = http.createServer(app);
const io = socketIo(server);

// Authentication routes
const authRoutes = require("./routes/auth");
app.use("/api/auth", authRoutes);

// Track number of connected users
let userCount = 0;

// Socket.io connection handling
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // Handle user joining
  socket.on("join", (userData) => {
    socket.username = userData.username;
    userCount++;
    io.emit("userCount", userCount);
    io.emit("userJoined", `${userData.username} joined`);
  });

  // Handle drawing event
  socket.on("draw", (data) => {
    // Add username to drawing data
    const drawingWithUser = { ...data, username: socket.username };
    socket.broadcast.emit("draw", drawingWithUser);
  });

  // Handle clear canvas event
  socket.on("clear", () => {
    socket.broadcast.emit("clear");
  });

  // Handle user disconnection
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);

    if (socket.username) {
      userCount--;
      io.emit("userCount", userCount);
      io.emit("userLeft", `${socket.username} left`);
    }
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
