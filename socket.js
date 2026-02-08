import http from "http";
import express from "express";
import { Server } from "socket.io";
import Notification from "./models/notification.model.js";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
});


const userSocketMap = new Map();

export const addSocketForUser = (userId, socketId) => {
  const key = String(userId);
  const set = userSocketMap.get(key) || new Set();
  set.add(socketId);
  userSocketMap.set(key, set);
};

export const removeSocketForUser = (userId, socketId) => {
  const key = String(userId);
  const set = userSocketMap.get(key);
  if (!set) return;
  set.delete(socketId);
  if (set.size === 0) userSocketMap.delete(key);
  else userSocketMap.set(key, set);
};

export const getSocketIdsForUser = (userId) => {
  const key = String(userId);
  return Array.from(userSocketMap.get(key) || []);
};

export const getSocketId = (userId) => {

  const ids = getSocketIdsForUser(userId);
  return ids.length ? ids[0] : undefined;
};


export const sendNotificationToUserSocket = (userId, eventName, payload) => {
  const socketIds = getSocketIdsForUser(userId);
  if (!socketIds.length) return false;
  for (const sid of socketIds) {
    io.to(sid).emit(eventName, payload);
  }
  return true;
};


io.on("connection", (socket) => {

  const userIdFromQuery = socket.handshake.query?.userId;
  if (userIdFromQuery) {
    addSocketForUser(userIdFromQuery, socket.id);
  }


  io.emit("getOnlineUsers", Array.from(userSocketMap.keys()));



  socket.on("register", async (userId) => {
    if (!userId) return;
    addSocketForUser(userId, socket.id);
    
    try {
        // 1. Fetch undelivered notifications
        const pending = await Notification.find({ userId, delivered: false })
            .sort({ createdAt: 1 })
            .lean();

        if (pending && pending.length) {
            for (const notif of pending) {
                // Frontend ko "notification" event bhejein
                socket.emit("notification", notif);
            }
            // 2. Mark as delivered takki baar baar na dikhe
            await Notification.updateMany(
                { userId, delivered: false }, 
                { delivered: true }
            );
        }
        
        // Online status update
        io.emit("getOnlineUsers", Array.from(userSocketMap.keys()));
    } catch (err) {
        console.error("Error flushing notifications:", err);
    }
});

 
  socket.on("sendMessage", (payload) => {
    const receiverSocketId = getSocketId(payload.receiverId);
    if (receiverSocketId) io.to(receiverSocketId).emit("newMessage", payload);
  });

  socket.on("joinChannel", (channelId) => {
    socket.join(channelId);
  });

  socket.on("leaveChannel", (channelId) => {
    socket.leave(channelId);
  });

 
  socket.on("webrtc:start-call", ({ to, from, offer }) => {
    const calleeSockets = getSocketIdsForUser(to);
    if (calleeSockets.length) {
      for (const sid of calleeSockets) io.to(sid).emit("webrtc:incoming-call", { from, offer });
    } else {
      io.to(socket.id).emit("webrtc:user-offline", { userId: to });
    }
  });

  socket.on("webrtc:answer-call", ({ to, from, answer }) => {
    const callerSockets = getSocketIdsForUser(to);
    if (callerSockets.length) {
      for (const sid of callerSockets) io.to(sid).emit("webrtc:call-answered", { from, answer });
    } else {
      io.to(socket.id).emit("webrtc:user-offline", { userId: to });
    }
  });

  socket.on("webrtc:ice-candidate", ({ to, candidate }) => {
    const recips = getSocketIdsForUser(to);
    for (const sid of recips) io.to(sid).emit("webrtc:ice-candidate", { candidate });
  });

  socket.on("webrtc:hang-up", ({ to }) => {
    const recips = getSocketIdsForUser(to);
    for (const sid of recips) io.to(sid).emit("webrtc:hang-up");
  });

 
  socket.on("disconnect", () => {

    for (const [uid, set] of userSocketMap.entries()) {
      if (set.has(socket.id)) {
        removeSocketForUser(uid, socket.id);
      }
    }
    io.emit("getOnlineUsers", Array.from(userSocketMap.keys()));
  });
});

export { app, io, server };
