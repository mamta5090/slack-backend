import Channel from '../models/channel.model.js';
import Message from '../models/message.model.js';
import mongoose from 'mongoose';
import { io, getSocketId } from '../socket.js';
import { deleteFromS3 } from '../config/s3.js';
import { json } from 'express';

export const createChannel = async (req, res) => {
    try {
        const createdBy = req.userId;
        if (!createdBy) {
            return res.status(401).json({ msg: 'Authentication error. User ID not found.' });
        }
        const { name, visibility, description } = req.body;
        if (!name) {
            return res.status(400).json({ msg: 'Please enter a channel name' });
        }
        const existingChannel = await Channel.findOne({ name });
        if (existingChannel) {
            return res.status(400).json({ msg: 'A channel with this name already exists' });
        }
        const newChannel = new Channel({
            name,
            visibility,
            description: description || '', 
            createdBy,
            managedBy: [createdBy],
            members: [createdBy]
        });
        const savedChannel = await newChannel.save();
        res.status(201).json(savedChannel);
    } catch (error) {
        console.error('CREATE CHANNEL ERROR:', error);
        res.status(500).json({ msg: 'Server error occurred while creating channel.' });
    }
};

export const addMember = async (req, res) => {
    try {
        const { channelId } = req.params;
        const { members } = req.body;
        const currentUserId = req.userId; 

        if (!members || !Array.isArray(members) || members.length === 0) {
            return res.status(400).json({ message: 'Member IDs must be provided as a non-empty array.' });
        }

        const channel = await Channel.findById(channelId);
        if (!channel) {
            return res.status(404).json({ message: 'Channel not found' });
        }

        if (!channel.managedBy.includes(currentUserId)) {
            return res.status(403).json({ message: 'You do not have permission to add members to this channel' });
        }

        const newMemberIds = members.filter(
            memberId => !channel.members.includes(memberId)
        );

        if (newMemberIds.length === 0) {
            return res.status(400).json({ message: 'All specified users are already members of this channel.' });
        }

        channel.members.push(...newMemberIds);
        await channel.save();
        
        res.status(200).json(channel);
    } catch (error) {
        console.error('ADD MEMBER ERROR:', error);
        res.status(500).json({ message: 'Server error while adding members', error });
    }
};

export const leaveChannel = async (req, res) => {
    try {
        const { channelId } = req.params;
        const userId = req.userId;

        const channel = await Channel.findById(channelId);
        if (!channel) {
            return res.status(404).json({ message: 'Channel not found' });
        }

        channel.members = channel.members.filter(memberId => memberId.toString() !== userId);
        channel.managedBy = channel.managedBy.filter(managerId => managerId.toString() !== userId);

        if (channel.members.length === 0) {
            await Channel.findByIdAndDelete(channelId);
            return res.status(200).json({ message: 'You left the channel, and it has been deleted.' });
        }

        await channel.save();
        res.status(200).json({ message: 'You have successfully left the channel.' });

    } catch (error) {
        console.error('LEAVE CHANNEL ERROR:', error);
        res.status(500).json({ message: 'Error leaving channel', error });
    }
};

export const getAllChannels = async (req, res) => {
  try {
    const userId = req.userId;
    if(!userId){
      return res.status(401).json({msg:'Authentication error. User ID not found.'})
    }
 const channels = await Channel.find({
        $or: [
            { visibility: 'public' },
            { members: userId }
        ]
    }).sort({name: 1});
    res.status(200).json(channels);
  } catch (error) {
    console.error('GET ALL CHANNELS ERROR:', error);
    // ✅ FIX: It was res. (500), changed to res.status(500)
    res.status(500).json({ msg: 'Server error occurred while fetching channels.' });
  }
}

export const getChannelById = async (req, res) => {
    try {
        const { channelId } = req.params;
        
        if (!mongoose.Types.ObjectId.isValid(channelId)) {
            return res.status(400).json({ message: 'Invalid channel ID format' });
        }
        const channel = await Channel.findById(channelId);
        if (!channel) {
            return res.status(404).json({ message: 'Channel not found' });
        }
        if (!channel.members.includes(req.userId)) {
            return res.status(403).json({ message: 'You are not a member of this channel' });
        }
        res.status(200).json(channel);
    } catch (error) {
        console.error('GET CHANNEL BY ID ERROR:', error);
        res.status(500).json({ msg: 'Server error while fetching channel details.' });
    }
};

export const sendMessageToChannel = async (req, res) => {
  try {
    const senderId = req.userId;
    const { channelId } = req.params;
    const { message } = req.body;
    const image = req.file ? req.file.location : null;
    const imageKey = req.file ? req.file.key : null;

    if (!senderId) return res.status(401).json({ message: "Unauthorized" });

    const channel = await Channel.findById(channelId);
    if (!channel) return res.status(404).json({ message: "Channel not found" });

    // 1. Save Message
    const newMessage = await Message.create({
        sender: senderId,
        channel: channelId,
        message: message || '',
        image: image,
        imageKey: imageKey,
    });

    // 2. Update Channel Counts
    const updateQuery = { $push: { messages: newMessage._id } };
    const incUpdate = {};

   channel.members.forEach(memberId => {
    if (memberId.toString() !== senderId.toString()) {
        incUpdate[`unreadCounts.${memberId.toString()}`] = 1;
    }
});

    if (Object.keys(incUpdate).length > 0) {
        updateQuery.$inc = incUpdate;
    }

    // 3. Get Updated Channel (with populated members)
    const updatedChannel = await Channel.findByIdAndUpdate(channelId, updateQuery, { new: true })
        .populate("members", "name profilePic profileImage");

    const populatedMessage = await Message.findById(newMessage._id)
        .populate("sender", "name profilePic profileImage");

    // 4. BROADCAST WITH LOGS
    console.log(`--- Broadcast Start for Channel: ${updatedChannel.name} ---`);
    
    updatedChannel.members.forEach(member => {
        if (member && member._id) {
            const memberIdStr = member._id.toString();
            const memberSocketId = getSocketId(memberIdStr);

            console.log(`Checking Member: ${member.name} (${memberIdStr}) - Socket: ${memberSocketId}`);

            if (memberSocketId) {
                io.to(memberSocketId).emit("newChannelMessage", {
                    message: populatedMessage,
                    channel: updatedChannel
                });
                console.log(`>> Sent notification to ${member.name}`);
            } else {
                console.log(`XX Member ${member.name} is OFFLINE (No Socket ID)`);
            }
        }
    });
    console.log(`--- Broadcast End ---`);

    res.status(201).json(populatedMessage);

  } catch (error) {
    console.error("Error in sendMessageToChannel:", error);
    return res.status(500).json({ message: `Server error: ${error.message}` });
  }
};

export const getChannelMessages = async (req, res) => {
    try {
        const { channelId } = req.params;
        const userId = req.userId;

        const channel = await Channel.findById(channelId);
        if (!channel || !channel.members.includes(userId)) {
            return res.status(403).json({ message: "Not authorized" });
        }

        const messages = await Message.find({ channel: channelId })
            .populate('sender', 'name profilePic profileImage email')
            .sort({ createdAt: 1 });

        res.status(200).json(messages);
    } catch (error) {
        console.error('Error in getChannelMessages:', error);
        res.status(500).json({ message: 'Server error while fetching messages.' });
    }
};

export const deleteMessageFromChannel = async (req, res) => {
  try {
    const { messageId, channelId } = req.params;
    const userId = req.userId;

    if (!messageId) return console.error("messageId missing");

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: 'Message not found' });
    if (message.sender.toString() !== userId)
      return res.status(403).json({ message: 'Not your message' });

    if (message.image && message.image.includes('.com/')) {
      const key = message.image.split('.com/')[1]; 
      await deleteFromS3(key); 
    }

    await Message.findByIdAndDelete(messageId);

    io.to(message.channel.toString()).emit('messageDeleted', { messageId });

    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const markChannelAsRead = async (req, res) => {
    try {
        const userId = req.userId;
        const { channelId } = req.params;

        await Channel.findByIdAndUpdate(channelId, {
            $set: { [`unreadCounts.${userId}`]: 0 }
        });

        res.status(200).json({ success: true, message: "Channel marked as read." });
    } catch (error) {
        console.error("Error marking channel as read:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const getChannelFiles = async (req, res) => {
  try {
    const { channelId } = req.params;
    const userId = req.userId;

    // 1. Verify Channel and Membership
    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }
    if (!channel.members.includes(userId)) {
      return res.status(403).json({ message: 'You are not a member of this channel' });
    }

    // 2. Fetch messages with attachments
    // We look for messages where 'image' is not null OR 'files' array exists/not empty
    const messages = await Message.find({
      channel: channelId,
      $or: [
        { image: { $ne: null, $ne: "" } }, // Checks your current 'image' field
        { files: { $exists: true, $not: { $size: 0 } } } // Checks if you have a 'files' array
      ]
    })
    .populate('sender', 'name profilePic')
    .sort({ createdAt: -1 }); // Newest first

    // 3. Initialize Categories
    const response = {
      images: [],
      videos: [],
      documents: []
    };

    // 4. Helper function to categorize file by extension
    const categorizeFile = (fileUrl, msgObj, fileMetadata = null) => {
      if (!fileUrl) return;

      // Get extension (e.g., 'png', 'pdf')
      const extension = fileUrl.split('.').pop().toLowerCase();

      const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
      const videoExts = ['mp4', 'webm', 'mov', 'avi', 'mkv'];
      const docExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'zip', 'rar'];

      const fileData = {
        _id: msgObj._id,
        url: fileUrl,
        name: fileMetadata?.name || fileUrl.split('/').pop(), // Try to get name from metadata or URL
        sender: msgObj.sender,
        createdAt: msgObj.createdAt,
        type: fileMetadata?.mimetype || 'unknown'
      };

      if (imageExts.includes(extension)) {
        response.images.push(fileData);
      } else if (videoExts.includes(extension)) {
        response.videos.push(fileData);
      } else {
        // Default to document if matches doc extension or just generic file
        response.documents.push(fileData);
      }
    };

    // 5. Iterate and Sort
    messages.forEach(msg => {
      // Handle the 'image' field (from your current controller logic)
      if (msg.image) {
        categorizeFile(msg.image, msg);
      }

      // Handle 'files' array (if you have updated your model to support multiple files)
      if (msg.files && Array.isArray(msg.files)) {
        msg.files.forEach(file => {
          categorizeFile(file.url, msg, file);
        });
      }
    });

    res.status(200).json(response);

  } catch (error) {
    console.error('GET CHANNEL FILES ERROR:', error);
    res.status(500).json({ message: 'Server error while fetching channel files.' });
  }
};

export const joinChannel=async(req,res)=>{
  try{
    const {channelId}=req.body;
  const userId=req.userId;

  const channel=await Channel.findById(channelId);
  if(!channel){
    return res.status(404).json({message:'Channel not found'});
  }

  if(channel.members.includes(userId)){
    return res.status(400).json({message:'You are ALREADY A MEMBER OF THIS CHANNEL'})
  }

  if(channel.visibility!=='public'){
    return res.status(403).json({message:'You cannot join a private channel directly.'})
  }

  channel.members.push(userId);
  await channel.save();

  res.status(200).json({message:'Joined channel successfully', channel})
  }catch(error){
    console.log('join channel error',error)
    res.status(500).json({message:'server error while joining channel'})
  }
}

// 1. Send a reply to a specific message in a channel
export const sendChannelReply = async (req, res) => {
  try {
    const senderId = req.userId;
    const { channelId, parentId } = req.params;
    const { message } = req.body;
    const image = req.file ? req.file.location : null;

    if (!parentId) return res.status(400).json({ message: "parentId is required" });

    // 1. Create the reply message
    const newReply = await Message.create({
      sender: senderId,
      channel: channelId,
      message: message || '',
      image: image,
      parentId: parentId // Links it to the thread
    });

    // 2. Increment reply count on the parent message
    await Message.findByIdAndUpdate(parentId, { $inc: { replyCount: 1 } });

    // 3. Populate for frontend
const populatedReply = await Message.findById(newReply._id)
  .populate("sender", "name profilePic profileImage");


    // 4. Socket Broadcast to the whole channel
    // We reuse the 'newChannelMessage' event but include parentId
    const channel = await Channel.findById(channelId).populate("members");
    
    channel.members.forEach(member => {
      const memberSocketId = getSocketId(member._id.toString());
      if (memberSocketId) {
       io.to(memberSocketId).emit("newChannelMessage", {
  message: populatedReply,
  channel: channel,          // 👈 add channel object
  parentId: parentId
});

      }
    });

    res.status(201).json(populatedReply);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 2. Get all replies for a channel thread
export const getChannelThreadMessages = async (req, res) => {
  try {
    const { parentId } = req.params;
    const replies = await Message.find({ parentId })
      .populate("sender", "name profilePic profileImage")
      .sort({ createdAt: 1 });
    res.status(200).json(replies);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};