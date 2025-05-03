const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

// Create HTTP server and socket.io instance
const server = http.createServer(app);
const io = socketIo(server);

// Track number of connected users
let userCount = 0;

// Socket.io connection handling
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // Increment user count and broadcast to all clients
  userCount++;
  io.emit("userCount", userCount);

  // Handle drawing event
  socket.on("draw", (data) => {
    // Broadcast the drawing data to all other clients
    socket.broadcast.emit("draw", data);
  });

  // Handle clear canvas event
  socket.on("clear", () => {
    socket.broadcast.emit("clear");
  });

  // Handle user disconnection
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);

    // Decrement user count and broadcast to all clients
    userCount--;
    io.emit("userCount", userCount);
  });
});

// Serve main page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
