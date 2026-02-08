// config/notification.service.js
import Notification from "../models/notification.model.js";
import { sendNotificationToUserSocket } from "../socket.js";

/**
 * Create a notification in DB and attempt realtime delivery.
 * - eventName used for realtime event is 'notification' (you can change if needed)
 */
export const createAndSendNotification = async ({
  userId,
  type,
  actorId = null,
  channelId = null,
  messageId = null,
  title,
  body,
  data = {},
}) => {
  // 1) persist
  const notif = await Notification.create({
    userId,
    type,
    actorId,
    channelId,
    message: messageId,
    title,
    body,
    data,
    isRead: false,
    delivered: false,
    createdAt: new Date(),
  });

  // 2) build payload for client
  const payload = {
    id: notif._id,
    userId: notif.userId,
    type: notif.type,
    title: notif.title,
    body: notif.body,
    data: notif.data,
    isRead: notif.isRead,
    createdAt: notif.createdAt,
  };

  // 3) attempt realtime delivery
  const sent = sendNotificationToUserSocket(String(userId), "notification", payload);

  // 4) mark delivered if we sent realtime
  if (sent) {
    await Notification.findByIdAndUpdate(notif._id, { delivered: true }).catch(() => {});
  }

  return notif;
};

export default { createAndSendNotification };
