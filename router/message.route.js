import express from "express";
import auth from "../middleware/auth.js";
import {
  sendMessage,
  getAllMessages,
  // getPreviousChat,
  deleteMessageController, 
  markAsRead,
  forwardMessage,
  reactToMessage,
  getThreadMessages,
  sendReply,
} from "../controller/message.controller.js";
import {upload} from '../middleware/multer.js'
import { uploadImage } from "../config/s3.js";

const router = express.Router();

router.post("/send/:receiverId", auth,uploadImage.single('image'), sendMessage);
router.get("/getAll/:receiverId", auth, getAllMessages);
// router.get("/previous", auth, getPreviousChat);
router.delete("/delete/:messageId", auth, deleteMessageController);
router.post("/mark-read",auth,markAsRead);
router.post("/forward", auth, forwardMessage);
router.post("/react/:messageId", auth, reactToMessage);
router.post("/reply/:receiverId", auth, uploadImage.single('image'), sendReply);
router.get("/thread/:parentId", auth, getThreadMessages);

export default router;
