import cron from "node-cron";
import Draft from "./models/draft.model.js"
import Message from "./models/message.model.js";
import Channel from "./models/channel.model.js";
import Conversation from "./models/conversation.model.js";
import { io, getSocketId } from "./socket.js";

// Run every minute
const startScheduler = () => {
  cron.schedule("* * * * *", async () => {
    const now = new Date();
    
    try {
      // Find drafts scheduled for now or in the past
      const dueMessages = await Draft.find({
        scheduledAt: { $lte: now },
      });

      for (const draft of dueMessages) {
        console.log(`Processing scheduled message for draft ID: ${draft._id}`);

        // 1. Create the actual Message
        const messageData = {
          sender: draft.sender,
          message: draft.message,
          files: draft.files,
          image: draft.image,
          imageKey: draft.imageKey,
          createdAt: new Date(),
        };

        if (draft.channel) messageData.channel = draft.channel;
        if (draft.receiver) messageData.receiver = draft.receiver;

        const newMessage = await Message.create(messageData);

        // 2. Handle Channel Logic
        if (draft.channel) {
          const channel = await Channel.findById(draft.channel);
          if (channel) {
            const incUpdate = {};
            channel.members.forEach((mid) => {
              if (mid.toString() !== draft.sender.toString()) {
                incUpdate[`unreadCounts.${mid}`] = 1;
              }
            });

            await Channel.findByIdAndUpdate(draft.channel, {
              $push: { messages: newMessage._id },
              $inc: incUpdate,
            });

            // Socket Notification
            const populatedMsg = await Message.findById(newMessage._id).populate("sender", "name profilePic");
            channel.members.forEach((memberId) => {
              const sid = getSocketId(memberId.toString());
              if (sid) {
                io.to(sid).emit("newChannelMessage", {
                  message: populatedMsg,
                  channel: channel,
                });
              }
            });
          }
        }

        // 3. Handle DM Logic
        if (draft.receiver) {
          await Conversation.findOneAndUpdate(
            { participants: { $all: [draft.sender, draft.receiver] } },
            {
              $push: { messages: newMessage._id },
              $inc: { [`unreadCounts.${draft.receiver}`]: 1 },
              lastNotificationSentAt: new Date(),
              updatedAt: new Date(),
            },
            { upsert: true }
          );

          // Socket Notification
          const populatedMsg = await Message.findById(newMessage._id).populate("sender", "name profilePic");
          const receiverSocket = getSocketId(draft.receiver.toString());
          if (receiverSocket) {
            io.to(receiverSocket).emit("newMessage", {
              newMessage: populatedMsg,
            });
          }
        }

        // 4. Remove the Draft/Scheduled item
        await Draft.findByIdAndDelete(draft._id);
        console.log(`Scheduled message sent and draft deleted: ${draft._id}`);
      }
    } catch (error) {
      console.error("Error in scheduler:", error);
    }
  });
};

export default startScheduler;