import dotenv from "dotenv";
import express from "express";
dotenv.config();

import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import connectDB from "./config/db.js";
import userRouter from "./router/user.route.js";
import conversationRoute from "./router/conversation.route.js";
import messageRoute from "./router/message.route.js";
import inviteRouter from "./router/invite.routes.js";
import slackRouter from "./router/slack.route.js";
import workspaceRouter from "./router/workspace.routes.js";
import channelController from "./router/channel.route.js";
import activityRouter from "./router/activity.routes.js";
import notificationRouter from "./router/notification.routes.js";
import filterRouter from "./router/filter.route.js";
import { app, server } from "./socket.js";
import auth from "./middleware/auth.js";
import User from "./models/User.js";
import draftRouter from "./router/draft.route.js";
import preferenceRouter from "./router/preference.router.js";
import startScheduler from "./scheduler.js";
app.use(
  cors({
    origin: [
      "http://localhost:5174",
      "http://localhost:5173",
      // "https://slack-frontend-4.onrender.com"
    ],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
// serve uploads statically so fallback local URLs work
app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));
const PORT = process.env.PORT || 5001;
app.get("/", (req, res) => res.send("server is running"));
app.get("/favicon.ico", (req, res) => res.status(204).end());
app.get("/api/user/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ user });
  } catch (err) {
    console.error("GET /api/user/me error:", err);
    res.status(500).json({ message: "Server error" });
  }
});
const SECRET_KEY = process.env.SECRET_KEY;
app.use("/api/user", userRouter);
app.use("/api/conversation", conversationRoute);
app.use("/api/message", messageRoute);
app.use("/api/invite", inviteRouter);
app.use("/api/slack", slackRouter);
app.use("/api/workspace", workspaceRouter);
app.use("/api/channel", channelController);
app.use("/api/activity", activityRouter);
app.use("/api/notifications",notificationRouter);
app.use("/api/files",filterRouter);
app.use('/api/draft',draftRouter)
app.use('/api/preferences',preferenceRouter);
startScheduler(); 
connectDB();
server.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});