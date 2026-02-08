import express from 'express';
import Message from '../models/message.model.js';
import Conversation from '../models/conversation.model.js';



export const getFilesByConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;

    if (!conversationId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({ message: "Invalid Conversation ID format" });
    }

    const convo = await Conversation.findById(conversationId).populate({
      path: "messages",
      populate: { path: "sender", select: "name profilePic" },
    });

    if (!convo) {
        return res.status(404).json({ message: "Conversation not found in DB" });
    }

    const messages = convo.messages;
    const media = [];
    const docs = [];

  
    const docMimes = new Set([
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain",
      "text/csv",
      "application/zip",
      "application/x-zip-compressed"
    ]);

    for (const m of messages) {
      if (Array.isArray(m.files) && m.files.length) {
        for (const f of m.files) {
        
          if (f.mimetype?.startsWith("image/") || f.mimetype?.startsWith("video/")) {
            media.push({ 
              message: m, 
              file: f,
              type: f.mimetype?.startsWith("video/") ? 'video' : 'image'
            });
          } 
        
          else if (docMimes.has(f.mimetype) || (f.name && /\.(pdf|docx?|xlsx?|pptx?|txt|csv|env)$/i.test(f.name))) {
            docs.push({ message: m, file: f });
          }
        }
      } 
     
      else if (m.image && /\.(png|jpe?g|gif|webp)$/i.test(m.image)) {
        media.push({ 
          message: m, 
          file: { url: m.image, name: "image" },
          type: 'image'
        });
      }
    }

  
    media.reverse();
    docs.reverse();

    return res.json({ images: media, docs });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

export const getFilesByReceiver = async (req, res) => {
  try {
    const senderId = req.userId;
    const { receiverId } = req.params;


    const convo = await Conversation.findOne({
      participants: { $all: [senderId, receiverId] }
    }).populate({
      path: "messages",
      populate: { path: "sender", select: "name profilePic" },
    });

    if (!convo) {

        return res.json({ images: [], docs: [] }); 
    }

    const messages = convo.messages;
    const media = [];
    const docs = [];

   
    const docMimes = new Set([
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain",
      "text/csv", 
      "application/zip"
    ]);

  
    for (const m of messages) {
      if (Array.isArray(m.files) && m.files.length) {
        for (const f of m.files) {
          if (f.mimetype?.startsWith("image/") || f.mimetype?.startsWith("video/")) {
            media.push({ 
              message: m, 
              file: f,
              type: f.mimetype?.startsWith("video/") ? 'video' : 'image'
            });
          } else if (docMimes.has(f.mimetype) || (f.name && /\.(pdf|docx?|xlsx?|pptx?|txt|csv|env)$/i.test(f.name))) {
            docs.push({ message: m, file: f });
          }
        }
      } 
 
      else if (m.image && /\.(png|jpe?g|gif|webp)$/i.test(m.image)) {
        media.push({ 
          message: m, 
          file: { url: m.image, name: "image" },
          type: 'image'
        });
      }
    }

    media.reverse();
    docs.reverse();

    return res.json({ images: media, docs });

  } catch (err) {
    console.error("Filter Error:", err);
    res.status(500).json({ message: err.message });
  }
}