import Message from '../models/message.model.js';
import Channel from '../models/channel.model.js';
import Notification from '../models/notification.model.js';
import User from '../models/User.js';
import {sendNotificationToUserSocket} from '../socket.js';
import { createAndSendNotification } from '../config/notification.service.js';
import { getSocketIdsForUser } from "../socket.js"; 

// export const personalNotifyHandler = async (req, res) => {
//   try {
//     const { messageId } = req.body;
//     if (!messageId) return res.status(400).json({ success: false, message: "messageId required" });

//     const message = await Message.findById(messageId).populate("sender").populate("receiver");
//     if (!message) return res.status(404).json({ success: false, message: "Message not found" });

//     const receiverId = message.receiver._id;
//     const title = `New message from ${message.sender.name}`;
//     const body = message.content || "";

//     const notif = await createAndSendNotification({
//       userId: receiverId,
//       type: "personal",
//       actorId: message.sender._id,
//       messageId: message._id,
//       title,
//       body,
//       data: { messageId: message._id },
//     });

    
//     return res.json({ success: true, notification: notif });
//   } catch (err) {
//     console.error("personalNotifyHandler error:", err);
//     return res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// export const channelNotifyHandler = async (req, res) => {
//   try {
//     const { messageId } = req.body;
//     if (!messageId) return res.status(400).json({ success: false, message: "messageId required" });

//     const message = await Message.findById(messageId).populate("sender").populate("channel");
//     if (!message) return res.status(404).json({ success: false, message: "Message not found" });

//     const channel = message.channel;
//     if (!channel) return res.status(400).json({ success: false, message: "Channel not found on message" });

//     // fetch members excluding sender
//     const members = await User.find({ _id: { $in: channel.members, $ne: message.sender._id } });
//     const created = [];
//     for (const member of members) {
//       const notif = await createAndSendNotification({
//         userId: member._id,
//         type: "channel",
//         actorId: message.sender._id,
//         channelId: channel._id,
//         messageId: message._id,
//         title: `New message in #${channel.name} from ${message.sender.name}`,
//         body: message.content || "",
//         data: { messageId: message._id, channelId: channel._id },
//       });
//       created.push(notif);
//     }

//     return res.json({ success: true, count: created.length });
//   } catch (err) {
//     console.error("channelNotifyHandler error:", err);
//     return res.status(500).json({ success: false, message: "Server error" });
//   }
// };


// export const getUserNotifications = async (req, res) => {
//   try {
//     const userId = req.userId; // Assuming auth middleware provides req.userId
//     const notifications = await Notification.find({ userId })
//         .sort({ createdAt: -1 })
//         .limit(50)
//         .populate("actorId", "name profilePic"); // Populate actor details

//     res.json({ success: true, notifications });
//   } catch (err) {
//     console.error("getUserNotifications error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// export const markNotificationAsRead = async (req, res) => {
//   try {
//     const { notificationId } = req.params;
//     const userId = req.userId;

//     const notif = await Notification.findOneAndUpdate(
//       { _id: notificationId, userId: userId }, // Ensure user can only mark their own notifications
//       { isRead: true },
//       { new: true } // Return the updated document
//     );

//     if (!notif) {
//       return res.status(404).json({ success: false, message: "Notification not found or you are not authorized" });
//     }
    
//     res.json({ success: true, message: "Notification marked as read", notification: notif });
//   } catch (err) {
//     console.error("markNotificationAsRead error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// export const markNotificationAsRead = async (req, res) => {
//   try {
//     const { notificationId } = req.params;
//     const notif = await Notification.findById(notificationId);
//     if (!notif) return res.status(404).json({ success: false, message: "Notification not found" });
//     notif.isRead = true;
//     await notif.save();
//     res.json({ success: true, message: "Notification marked as read", notification: notif });
//   } catch (err) {
//     console.error("markNotificationAsRead error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

export const getUserNotifications = async (req, res) => {
  try {
    const userId = req.userId;
    const notifications = await Notification.find({ userId })
        .populate("actorId", "name profilePic")  
        .sort({ createdAt: -1 })
        .limit(50);
    res.json({ success: true, notifications });
  } catch (err) {
    console.error("getUserNotifications error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// export const createVoiceCallNotification = async ({ userId, actorId, callType, callData }) => {
//   try {
//     const actor = await User.findById(actorId);
//     if (!actor) throw new Error("Actor user not found");
//     const title = `Incoming ${callType} call from ${actor.name}`;
//     const body = `${actor.name} is calling you.`;

//     const notif = await createAndSendNotification({
//       userId,
//       type: "call",
//       actorId,
//       title,
//       body,
//       data: callData,
//     });

//     return notif;
//   } catch (err) {
//     console.error("createVoiceCallNotification error:", err);
//     throw err;
//   }
// };

// export const broadcastChannelNotification = async (channel, notificationData) => {
//   try {
//     console.log(`--- Broadcast Start for Channel: ${channel.name || "Unknown"} ---`);
//     if (!channel?.members || channel.members.length === 0) {
//       console.log("No members found in channel.");
//       return;
//     }

//     const members = channel.members.map(m => (typeof m === "object" ? m : { _id: m }));

//     const senderId = notificationData.fullMessage?.sender?._id || notificationData.senderId || null;

//     const docs = [];
//     for (const member of members) {
//       if (senderId && String(member._id) === String(senderId)) continue;
//       docs.push({
//         userId: member._id,
//         type: "channel",
//         actorId: senderId || null,
//         channelId: channel._id,
//         messageId: notificationData.fullMessage?._id || null,
//         title: `New message in #${channel.name}`,
//         body: notificationData.message || "",
//         data: {
//           channelName: channel.name,
//           channelId: channel._id,
//           messageId: notificationData.fullMessage?._id || null,
//         },
//         isRead: false,
//         delivered: false,
//         createdAt: new Date(),
//       });
//     }

//     // Persist notifications to DB (queued for offline users)
//     const inserted = docs.length ? await Notification.insertMany(docs) : [];

//     // Emit to online sockets
//     for (const member of members) {
//       const socketIds = getSocketIdsForUser(member._id);
//       process.stdout.write(`Checking Member: ${member.name || member._id} (${member._id}) - Sockets: ${socketIds.length ? socketIds.join(",") : "none"}\n`);

//       if (socketIds.length) {
//         // send full message to sockets (if provided) so channel UI updates
//         if (notificationData.fullMessage) {
//           for (const sid of socketIds) {
//             io.to(sid).emit("newChannelMessage", {
//               message: notificationData.fullMessage,
//               channel,
//             });
//           }
//         }

//         // find inserted notification id
//         const notifForUser = inserted.find(n => String(n.userId) === String(member._id));

//         // send popup event
//         const payload = {
//           type: "CHANNEL_ACTIVITY",
//           channelId: channel._id,
//           channelName: channel.name,
//           message: notificationData.message,
//           sender: notificationData.senderName,
//           notificationId: notifForUser?._id ?? null,
//           timestamp: new Date(),
//         };
//         for (const sid of socketIds) {
//           io.to(sid).emit("channelNotification", payload);
//         }

//         // mark that user's notifications delivered (optional: mark only those delivered)
//         if (notifForUser) {
//           await Notification.findByIdAndUpdate(notifForUser._id, { delivered: true });
//         }
//         console.log(`>> Sent notification to ${member.name || member._id}`);
//       } else {
//         console.log(`XX Member ${member.name || member._id} is OFFLINE (No Socket)`);
//         // offline -> already queued by insertMany
//         // optionally trigger push (FCM/WebPush) here
//       }
//     }

//     console.log(`--- Broadcast End ---`);
//   } catch (err) {
//     console.error("broadcastChannelNotification error:", err);
//   }
// };