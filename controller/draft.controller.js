import Draft from "../models/draft.model.js";
import Message from "../models/message.model.js";
import Channel from "../models/channel.model.js";
import User from "../models/User.js";
import Conversation from "../models/conversation.model.js";
import { deleteFromS3 } from "../config/s3.js";
import { getSocketId, io } from "../socket.js";

// --- Create or Schedule a Draft ---
export const createDraft = async (req, res) => {
  try {
    const senderId = req.userId;
    const { receiverId, channelId, message, scheduledAt } = req.body;

    const filesArray = [];
    if (req.file) {
      filesArray.push({
        name: req.file.originalname,
        url: req.file.location,
        mimetype: req.file.mimetype,
        key: req.file.key,
      });
    }

    const newDraft = new Draft({
      sender: senderId,
      receiver: receiverId || null,
      channel: channelId || null,
      message: message || "",
      files: filesArray,
      image: filesArray.length > 0 ? filesArray[0].url : null,
      imageKey: filesArray.length > 0 ? filesArray[0].key : null,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
    });

    await newDraft.save();
    res.status(201).json(newDraft);
  } catch (error) {
    console.error("Create Draft Error:", error);
    res.status(500).json({ message: "Error creating draft" });
  }
};

// --- Get Drafts ---
export const getDrafts = async (req, res) => {
  try {
    const userId = req.userId;
    const drafts = await Draft.find({
      sender: userId,
      scheduledAt: null,
    })
      // FIX: Added 'profileImage' to the select string
      .populate("receiver", "name profilePic profileImage") 
      .populate("channel", "name")
      .sort({ updatedAt: -1 });

    res.status(200).json(drafts);
  } catch (error) {
    res.status(500).json({ message: "Error fetching drafts" });
  }
};

// --- Get Scheduled Messages ---
export const getScheduledMessages = async (req, res) => {
  try {
    const userId = req.userId;
    const scheduled = await Draft.find({
      sender: userId,
      scheduledAt: { $ne: null },
    })
      // FIX: Added 'profileImage' here too
      .populate("receiver", "name profilePic profileImage") 
      .populate("channel", "name")
      .sort({ scheduledAt: 1 });

    res.status(200).json(scheduled);
  } catch (error) {
    res.status(500).json({ message: "Error fetching scheduled messages" });
  }
};

// --- Get Sent Messages ---
export const getSentMessages = async (req, res) => {
  try {
    const userId = req.userId;
    const sent = await Message.find({ sender: userId })
      // FIX: Added 'profileImage' here. 
      // This ensures we get the image regardless of whether it's stored as profilePic or profileImage
      .populate("receiver", "name profilePic profileImage") 
      .populate("channel", "name") 
      .sort({ createdAt: -1 }); 

    res.status(200).json(sent);
  } catch (error) {
    res.status(500).json({ message: "Error fetching sent messages" });
  }
};

// --- Delete Draft ---
export const deleteDraft = async (req, res) => {
  try {
    const { draftId } = req.params;
    const userId = req.userId;

    const draft = await Draft.findById(draftId);
    if (!draft) return res.status(404).json({ message: "Draft not found" });

    if (draft.sender.toString() !== userId) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    if (draft.imageKey) await deleteFromS3(draft.imageKey);

    await Draft.findByIdAndDelete(draftId);
    res.status(200).json({ message: "Draft deleted" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting draft" });
  }
};

// --- Send Draft Immediately ---
export const sendDraftImmediately = async (req, res) => {
  try {
    const { draftId } = req.params;
    const userId = req.userId;

    const draft = await Draft.findById(draftId);
    if (!draft) return res.status(404).json({ message: "Draft not found" });

    const messageData = {
      sender: userId,
      message: draft.message,
      files: draft.files,
      image: draft.image,
      imageKey: draft.imageKey,
    };

    if (draft.channel) messageData.channel = draft.channel;
    if (draft.receiver) messageData.receiver = draft.receiver;

    const newMessage = await Message.create(messageData);

    if (draft.channel) {
      const channel = await Channel.findById(draft.channel);
      if (channel) {
        const incUpdate = {};
        channel.members.forEach((mid) => {
          if (mid.toString() !== userId) incUpdate[`unreadCounts.${mid}`] = 1;
        });

        await Channel.findByIdAndUpdate(draft.channel, {
          $push: { messages: newMessage._id },
          $inc: incUpdate,
        });

        const populatedMsg = await Message.findById(newMessage._id).populate("sender", "name profilePic profileImage");
        channel.members.forEach((memberId) => {
           const sid = getSocketId(memberId.toString());
           if(sid) io.to(sid).emit("newChannelMessage", { message: populatedMsg, channel });
        });
      }
    } else if (draft.receiver) {
      await Conversation.findOneAndUpdate(
        { participants: { $all: [userId, draft.receiver] } },
        {
          $push: { messages: newMessage._id },
          $inc: { [`unreadCounts.${draft.receiver}`]: 1 },
          lastNotificationSentAt: new Date(),
          updatedAt: new Date(),
        },
        { upsert: true }
      );

      const populatedMsg = await Message.findById(newMessage._id).populate("sender", "name profilePic profileImage");
      const receiverSocket = getSocketId(draft.receiver.toString());
      if (receiverSocket) {
        io.to(receiverSocket).emit("newMessage", { newMessage: populatedMsg });
      }
    }

    await Draft.findByIdAndDelete(draftId);

    res.status(200).json({ message: "Draft sent successfully", sentMessage: newMessage });
  } catch (error) {
    console.error("Send Draft Error", error);
    res.status(500).json({ message: "Error sending draft" });
  }
};