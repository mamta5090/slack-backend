import express from "express";
import {
  // personalNotifyHandler,
  // channelNotifyHandler,
  getUserNotifications,
  // markNotificationAsRead,
} from "../controller/notification.controller.js";
import auth from "../middleware/auth.js";

const router = express.Router();

// router.post("/personal/notify",auth, personalNotifyHandler);
// router.post("/channel/notify",auth, channelNotifyHandler);
 router.get("/user/notifications",auth, getUserNotifications);
//  router.put("/:notificationId/read",auth, markNotificationAsRead);

export default router;
