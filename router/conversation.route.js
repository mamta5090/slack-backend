import express from "express";
import auth from "../middleware/auth.js"
import {
  createOrGetConversation,
  getUserConversations,
  getConversationById,
  getMyConversations,
  markConversationAsRead, 
  updateConversationTopic,
  createGroupConversation,
} from "../controller/conversation.controller.js";

const router = express.Router();

router.post("/", createOrGetConversation);
router.get("/my", auth, getMyConversations);
router.get("/user/:userId", getUserConversations);
router.get("/:id", getConversationById);
router.post("/read/:id", auth, markConversationAsRead);
router.put("/topic/with/:otherUserId", auth, updateConversationTopic);
router.post("/group", auth, createGroupConversation);
router.put("/mark-read/:id", auth, markConversationAsRead);

export default router;