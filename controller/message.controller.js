import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import User from "../models/User.js"; 
//import { getSocketId, io } from "../socket.js";
import { getSocketId, getSocketIdsForUser, io } from "../socket.js";
import { deleteFromS3 } from '../config/s3.js';
import { createActivity } from './activity.controller.js'; 
import { createAndSendNotification } from '../config/notification.service.js';

const NOTIFICATION_COOLDOWN_MS = 1 * 60 * 1000;

export const sendMessage = async (req, res) => {
  try {
    const senderId = req.userId;
    const { receiverId } = req.params;
    const { message } = req.body;

    // 1. Handle File Uploads
    const filesArray = [];
    if (req.file) {
      filesArray.push({
        name: req.file.originalname || "file",
        url: req.file.location || req.file.path || "",
        mimetype: req.file.mimetype || "",
        key: req.file.key || "",
      });
    }

    if (req.files && Array.isArray(req.files)) {
      req.files.forEach(f => {
        filesArray.push({
          name: f.originalname || "file",
          url: f.location || f.path || "",
          mimetype: f.mimetype || "",
          key: f.key || "",
        });
      });
    }

    if (!message && filesArray.length === 0) {
      return res.status(400).json({ message: "Message content cannot be empty." });
    }

    // 2. Prepare Message Document
    const docToCreate = {
      sender: senderId,
      receiver: receiverId,
      message: message || '',
      files: filesArray,
    };

    // Compatibility for legacy image fields
    if (filesArray.length === 1 && filesArray[0].mimetype?.startsWith("image/")) {
      docToCreate.image = filesArray[0].url;
      docToCreate.imageKey = filesArray[0].key || "";
    }

    const newMessage = await Message.create(docToCreate);

    // 3. Update Conversation & Increment Unread Count
    // This is the core logic for your sidebar badges
    const updatedConversation = await Conversation.findOneAndUpdate(
      { participants: { $all: [senderId, receiverId] } }, 
      {
        $push: { messages: newMessage._id }, 
        $inc: { [`unreadCounts.${receiverId}`]: 1 }, // Increment receiver's unread count
        lastNotificationSentAt: new Date(),
        updatedAt: new Date(),
      },
      { upsert: true, new: true }
    ).populate("participants", "name email profilePic");

    // 4. Populate message details for frontend
    const populatedNewMessage = await Message.findById(newMessage._id)
      .populate("sender", "name email profilePic");

    // 5. Socket Logic (Real-Time)
    const receiverSocketIds = getSocketIdsForUser(receiverId);
    const senderSocketIds = getSocketIdsForUser(senderId);

    const socketPayload = {
      newMessage: populatedNewMessage,
      updatedConversation // Frontend uses this to update the Redux store/Sidebar
    };

    // Send to all sender's active tabs
    senderSocketIds.forEach(sid => io.to(sid).emit("newMessage", socketPayload));

  if (receiverSocketIds.length > 0) {
    // User online hai: Direct message bhej do
    receiverSocketIds.forEach(sid => io.to(sid).emit("newMessage", socketPayload));
} else {
    // User OFFLINE hai: DB mein notification save karein
    await Notification.create({
        userId: receiverId,
        type: "personal_message",
        actorId: senderId,
        title: `New message from ${sender.name}`,
        body: message || "Sent a file",
        delivered: false // Important: isse pata chalega ki deliver nahi hua
    });
}

    return res.status(201).json(populatedNewMessage);

  } catch (error) {
    console.error("sendMessage error:", error);
    return res.status(500).json({ message: `Send Message error: ${error.message}` });
  }
};


export const getAllMessages = async (req, res) => {
  try {
    const senderId = req.userId;
    const receiverId = req.params.receiverId;

    if (!senderId || !receiverId) {
      return res.status(400).json({ message: "senderId and receiverId are required" });
    }

    const conversation = await Conversation.findOne({
      participants: { $all: [senderId, receiverId] },
    }).populate({
      path: "messages",
      populate: {
        path: "sender",
        select: "name email profilePic", // ✅ VERY IMPORTANT
      },
    });

    if (!conversation) return res.status(200).json([]);

    return res.status(200).json(conversation.messages);
  } catch (error) {
    console.error("getAllMessages error:", error);
    return res.status(500).json({ message: error.message });
  }
};



// export const getPreviousChat = async (req, res) => {
//   try {
//     const currentUserId = req.userId;
//     const conversations = await Conversation.find({
//       participants: currentUserId,
//     })
//       .populate("participants", "-password")
//       .sort({ updatedAt: -1 });
//     const userMap = {};
//     conversations.forEach((convo) => {
//       convo.participants.forEach((user) => {
//         if (String(user._id) !== String(currentUserId)) {
//           userMap[user._id] = user;
//         }
//       });
//     });
//     const previousUsers = Object.values(userMap);
//     return res.status(200).json(previousUsers);
//   } catch (error) {
//     console.error("getPreviousChat error:", error);
//     return res
//       .status(500)
//       .json({ message: `previousUsers error ${error.message || error}` });
//   }
// };


export const deleteMessageController = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.userId;

    if (!messageId) {
      return res.status(400).json({ message: "messageId is required" });
    }
    const msg = await Message.findById(messageId);
    if (!msg) return res.status(404).json({ message: "Message not found" });

    if (msg.sender.toString() !== userId) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (msg.imageKey) {
      try {
        await deleteFromS3(msg.imageKey);
      } catch (err) {
        console.error("Failed to delete S3 object (by imageKey):", err);
      }
    } else if (msg.image && typeof msg.image === "string" && msg.image.includes(".amazonaws.com/")) {
      const parts = msg.image.split(".com/");
      const key = parts[1];
      if (key) {
        try {
          await deleteFromS3(key);
        } catch (err) {
          console.error("Failed to delete S3 object (parsed from image URL):", err);
        }
      }
    }

    await Message.findByIdAndDelete(messageId);

    await Conversation.updateMany(
      { messages: messageId },
      { $pull: { messages: messageId } }
    );

    const payload = { messageId };
    try {
      const senderSocketId = getSocketId(msg.sender.toString());
      const receiverSocketId = getSocketId(msg.receiver.toString());

      if (senderSocketId) io.to(senderSocketId).emit("messageDeleted", payload);
      if (receiverSocketId) io.to(receiverSocketId).emit("messageDeleted", payload);
    } catch (emitErr) {
      console.error("Socket emit error while deleting message:", emitErr);
    }

    return res.json({ success: true, message: "Message deleted" });
  } catch (error) {
    console.error("deleteMessageController error:", error);
    return res.status(500).json({ message: "Failed to delete message", error: error.message });
  }
};

export const markAsRead = async (req, res) => {
  try {
    const currentUserId = req.userId;
    const { conversationId } = req.body;

    if (!conversationId) {
      return res.status(400).json({ message: "Conversation ID is required" });
    }

    // Find conversation and set the current user's unread count to 0
    const updatedConversation = await Conversation.findByIdAndUpdate(
      conversationId,
      {
        $set: { [`unreadCounts.${currentUserId}`]: 0 }
      },
      { new: true } // Return the updated document
    ).populate("participants", "name email profilePic");

    if (!updatedConversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    // Optional: Emit a socket event to the user themselves so all their tabs update
    // io.to(getSocketId(currentUserId)).emit("conversationUpdated", updatedConversation);

    return res.status(200).json(updatedConversation);
  } catch (error) {
    console.error("markAsRead error:", error);
    return res.status(500).json({ message: error.message });
  }
};

export const forwardMessage = async (req, res) => {
  try {
    const senderId = req.userId;
    const { originalMessageId, receiverIds,additionalMessage  } = req.body;

    if (!originalMessageId || !receiverIds || !Array.isArray(receiverIds) || receiverIds.length === 0) {
      return res.status(400).json({ 
        message: "Original message ID and an array of Receiver IDs are required." 
      });
    }

    const originalMessage = await Message.findById(originalMessageId);
    if (!originalMessage) {
      return res.status(404).json({ message: "Original message not found." });
    }

    const sender = await User.findById(senderId).select("name");

    const forwardResults = await Promise.all(
      receiverIds.map(async (receiverId) => {
        const newMessage = await Message.create({
  sender: senderId,                  
  receiver: receiverId,
  message: originalMessage.message || "",
  files: originalMessage.files || [],
  image: originalMessage.image,
  imageKey: originalMessage.imageKey,

  isForwarded: true,                   
  forwardedFrom: originalMessage.sender,
});


        const updatedConversation = await Conversation.findOneAndUpdate(
          { participants: { $all: [senderId, receiverId] } },
          {
            $push: { messages: newMessage._id },
            $inc: { [`unreadCounts.${receiverId}`]: 1 },
            lastNotificationSentAt: new Date(),
            updatedAt: new Date(),
          },
          { upsert: true, new: true }
        ).populate("participants", "name email profilePic");

const populatedNewMessage = await Message.findById(newMessage._id)
  .populate("sender", "name profilePic")
  .populate("forwardedFrom", "name profilePic"); // ✅


        const receiverSocketId = getSocketId(receiverId);
        const senderSocketId = getSocketId(senderId);

        const socketPayload = {
          newMessage: populatedNewMessage,
          updatedConversation,
        };

        if (senderSocketId) io.to(senderSocketId).emit("newMessage", socketPayload);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("newMessage", socketPayload);
        } else {
          // --- FIX: Wrapped in try-catch and changed notification type ---
          try {
            if (sender) {
              await createAndSendNotification({
                userId: receiverId,
                // CHANGE "personal_message" to "message" or whatever your enum allows
                type: "message", 
                actorId: senderId,
                title: `${sender.name} forwarded a message`,
                body: populatedNewMessage.message || "Sent a file",
              });
            }
          } catch (notificationError) {
            console.error("Notification failed to send, but message was created:", notificationError.message);
            // We don't throw the error here so the loop continues
          }
        }

        return populatedNewMessage;
      })
    );

    return res.status(201).json({
      success: true,
      messages: forwardResults,
      openChatUserId: receiverIds[0]
    });

  } catch (error) {
    console.error("forwardMessage error:", error);
    return res.status(500).json({ 
      message: `Forward error: ${error.message}` 
    });
  }
};

// controller/message.controller.js

export const reactToMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.userId;

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: "Message not found" });

    // Find if this emoji already exists in reactions
    const reactionIndex = message.reactions.findIndex(r => r.emoji === emoji);

    if (reactionIndex > -1) {
      const userIndex = message.reactions[reactionIndex].users.indexOf(userId);
      if (userIndex > -1) {
        // User already reacted -> Remove them (Toggle off)
        message.reactions[reactionIndex].users.splice(userIndex, 1);
        if (message.reactions[reactionIndex].users.length === 0) {
          message.reactions.splice(reactionIndex, 1);
        }
      } else {
        // Emoji exists but user hasn't reacted -> Add them
        message.reactions[reactionIndex].users.push(userId);
      }
    } else {
      // New emoji reaction
      message.reactions.push({ emoji, users: [userId] });
    }

    await message.save();

    // Populate sender and reactions so frontend has all info to re-render
    const populatedMsg = await Message.findById(messageId)
      .populate("sender", "name email profilePic")
      .lean();

    // Find conversation to find all participants to notify
    const convo = await Conversation.findOne({ messages: messageId });
    
    if (convo) {
      convo.participants.forEach(pId => {
        // Now using the imported function to get ALL socket IDs for the user (handles multiple tabs)
        const socketIds = getSocketIdsForUser(pId.toString()); 
        socketIds.forEach(sid => {
          io.to(sid).emit("messageUpdate", populatedMsg);
        });
      });
    }

    res.status(200).json(populatedMsg);
  } catch (error) {
    console.error("React error:", error);
    res.status(500).json({ message: error.message });
  }
};

export const sendReply = async (req, res) => {
  try {
    const senderId = req.userId;
    const { receiverId } = req.params;
    const { message, parentId } = req.body;

    if (!parentId) {
      return res.status(400).json({ message: "parentId is required for a reply" });
    }

    const filesArray = [];
    if (req.file) {
      filesArray.push({
        name: req.file.originalname,
        url: req.file.location || req.file.path,
        mimetype: req.file.mimetype,
      });
    }

    const docToCreate = {
      sender: senderId,
      receiver: receiverId,
      message: message || '',
      files: filesArray,
      parentId: parentId
    };

    if (filesArray.length === 1 && filesArray[0].mimetype?.startsWith("image/")) {
      docToCreate.image = filesArray[0].url;
    }

    // 1. Create the reply
    const newReply = await Message.create(docToCreate);

    // 2. Increment parent reply count in DB
    await Message.findByIdAndUpdate(parentId, { $inc: { replyCount: 1 } });

    // 3. Update conversation timestamp
    const updatedConversation = await Conversation.findOneAndUpdate(
      { participants: { $all: [senderId, receiverId] } },
      { $push: { messages: newReply._id }, updatedAt: new Date() },
      { new: true }
    ).populate("participants", "name email profilePic");

    // 4. Populate reply for frontend
    const populatedReply = await Message.findById(newReply._id)
      .populate("sender", "name email profilePic");

    // 5. Get Socket IDs
    const senderSocketIds = getSocketIdsForUser(senderId);
    const receiverSocketIds = getSocketIdsForUser(receiverId);

    const payload = {
      newMessage: populatedReply,
      updatedConversation,
      parentId: String(parentId) // Ensure this is a string
    };

    // 6. EMIT SOCKET EVENTS (MUST happen before return)
    senderSocketIds.forEach(sid => io.to(sid).emit("newMessage", payload));
    receiverSocketIds.forEach(sid => io.to(sid).emit("newMessage", payload));

    // 7. FINAL RESPONSE
    return res.status(201).json(populatedReply);

  } catch (error) {
    console.error("sendReply error:", error);
    return res.status(500).json({ message: error.message });
  }
};

// 2. Get all replies for a specific message thread
export const getThreadMessages = async (req, res) => {
  try {
    const { parentId } = req.params;

    const replies = await Message.find({ parentId })
      .populate("sender", "name email profilePic")
      .sort({ createdAt: 1 }); // Sort by oldest first for threads

    return res.status(200).json(replies);
  } catch (error) {
    console.error("getThreadMessages error:", error);
    return res.status(500).json({ message: error.message });
  }
};