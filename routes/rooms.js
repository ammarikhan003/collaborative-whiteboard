const express = require("express");
const router = express.Router();
const Room = require("../models/Room");
const User = require("../models/User");
const jwt = require("jsonwebtoken");

const JWT_SECRET = "my-secret-key"; // Replace with me actual secret key

// Middleware to authenticate JWT
const authenticate = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { id: decoded.id, username: decoded.username };
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid token" });
  }
};

// Get all public rooms
router.get("/public", async (req, res) => {
  try {
    const rooms = await Room.find({ isPrivate: false })
      .select("name owner createdAt participants")
      .populate("owner", "username")
      .sort("-createdAt");
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Get user's rooms
router.get("/my-rooms", authenticate, async (req, res) => {
  try {
    // Find rooms where user is owner or participant
    const rooms = await Room.find({
      $or: [{ owner: req.user.id }, { participants: req.user.id }],
    })
      .select("name owner createdAt participants isPrivate")
      .populate("owner", "username")
      .sort("-createdAt");

    res.json(rooms);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Create a new room
router.post("/", authenticate, async (req, res) => {
  try {
    const { name, password, isPrivate } = req.body;

    // Check if room name already exists
    const roomExists = await Room.findOne({ name });
    if (roomExists) {
      return res.status(400).json({ message: "Room name already exists" });
    }

    // Create new room
    const room = new Room({
      name,
      owner: req.user.id,
      password: password || "",
      isPrivate: isPrivate || false,
      participants: [req.user.id],
    });

    await room.save();

    res.status(201).json({
      _id: room._id,
      name: room.name,
      isPrivate: room.isPrivate,
      hasPassword: !!room.password,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Join a room
router.post("/join/:roomId", authenticate, async (req, res) => {
  try {
    const { password } = req.body;
    const room = await Room.findById(req.params.roomId);

    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    // Check password if the room is password protected
    if (room.password && room.password !== password) {
      return res.status(401).json({ message: "Incorrect password" });
    }

    // Add user to participants if not already there
    if (!room.participants.includes(req.user.id)) {
      room.participants.push(req.user.id);
      await room.save();
    }

    res.json({
      _id: room._id,
      name: room.name,
      isPrivate: room.isPrivate,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Delete a room (owner only)
router.delete("/:roomId", authenticate, async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId);

    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    // Check if user is the owner
    if (room.owner.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ message: "Not authorized to delete this room" });
    }

    await room.deleteOne();
    res.json({ message: "Room deleted" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
