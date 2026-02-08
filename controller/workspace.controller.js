// controller/workspace.controller.js
import Workspace from "../models/Workspace.model.js";
import SlackUser from "../models/slackUser.model.js";
import Mail from "../config/Mail.js";
//import {uploadOnCloundinary} from '../config/cloudinary.js'
import path from 'path'


export const createWorkspace = async (req, res) => {
  try {
    if (!req.userId) {
      console.warn('createWorkspace: missing req.userId. Is auth middleware applied?');
      return res.status(401).json({ message: 'Authentication required' });
    }
    const { name ,owner,members} = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Workspace name required' });
    }
    const slackUser = await SlackUser.findById(req.userId);
    if (!slackUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    const workspace = await Workspace.create({
      name: name.trim(),
      owner: slackUser._id,
      members: [slackUser._id],
    });
    try {
      slackUser.workspace = workspace._id;
      await slackUser.save();
    } catch (userSaveErr) {
      console.error('Failed to update user with workspace id', userSaveErr);
    }
    return res.status(201).json({ success: true, workspace });
  } catch (err) {
    console.error("createWorkspace error:", err && err.stack ? err.stack : err);
    if (process.env.NODE_ENV === 'development') {
      return res.status(500).json({ message: 'Failed to create workspace', error: err?.message || err });
    }
    return res.status(500).json({ message: "Failed to create workspace" });
  }
};

export const inviteToWorkspace = async (req, res) => {
  try {
    const workspaceId = req.params.id;
    const { emails } = req.body;
    if (!emails) return res.status(400).json({ message: "emails required" });

    const emailList = Array.isArray(emails)
      ? emails
      : emails.split(",").map(e => e.trim()).filter(Boolean);

    if (!emailList.length) return res.status(400).json({ message: "No valid emails provided" });

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) return res.status(404).json({ message: "Workspace not found" });

    const createdOrFound = [];
    for (const email of emailList) {
      let user = await SlackUser.findOne({ email });
      if (!user) {
        user = await SlackUser.create({ email }); // minimal record
      }

      if (!workspace.members.some(m => m.toString() === user._id.toString())) {
        workspace.members.push(user._id);
      }
      createdOrFound.push(user);

    
      try {
        const inviteLink = `${process.env.CLIENT_URL || "http://localhost:3000"}/join?workspace=${workspace._id}&email=${encodeURIComponent(email)}`;
        await Mail({ to: email, workspaceName: workspace.name, inviteLink });
      } catch (e) {
        console.warn("failed to send invite email for", email, e.message);
      }
    }

    await workspace.save();
    return res.json({ success: true, workspace, invited: createdOrFound.map(u => ({ email: u.email, id: u._id })) });
  } catch (err) {
    console.error("inviteToWorkspace error", err);
    return res.status(500).json({ message: "Failed to invite" });
  }
};



export const updateWorkspace = async (req, res) => {
  try {
    console.log("=== updateWorkspace called ===");
    console.log("req.userId:", req.userId);
    console.log("req.body:", req.body);
    console.log("req.file:", req.file ? {
      fieldname: req.file.fieldname,
      originalname: req.file.originalname,
      filename: req.file.filename,
      path: req.file.path,
      size: req.file.size,
      mimetype: req.file.mimetype
    } : null);

    const { id } = req.params;
    const updates = { ...(req.body || {}) };

    // Normalize owners if it comes as an array (FormData sometimes produces array)
    if (updates.owners && Array.isArray(updates.owners)) {
      updates.owners = updates.owners[updates.owners.length - 1];
    }

    if (req.file) {
      let imageUrl = null;
      const filePath = req.file.path && path.resolve(req.file.path);

      // Try Cloudinary if configured
      if (process.env.CLOUD_NAME && process.env.CLOUD_API && process.env.CLOUD_SECRET) {
        try {
          const result = await uploadOnCloudinary(filePath);
          imageUrl = result?.secure_url || result?.url || null;
        } catch (cloudErr) {
          console.warn("Cloudinary upload failed:", cloudErr?.message || cloudErr);
        }
      }

      // Fallback to local uploads served at /uploads
      if (!imageUrl) {
        const filename = req.file.filename || path.basename(filePath || "");
        imageUrl = `${process.env.SERVER_URL || "http://localhost:1"}/uploads/${filename}`;
      }
      updates.profileImage = imageUrl;
    }

    // Update SlackUser if owners present and req.userId exists
    if (updates.owners && req.userId) {
      try {
        const ownerName = typeof updates.owners === "string" ? updates.owners : String(updates.owners);
        const userUpdates = { name: ownerName };
        if (updates.profileImage) userUpdates.profileImage = updates.profileImage;
        await SlackUser.findByIdAndUpdate(req.userId, userUpdates, { new: true });
      } catch (userErr) {
        console.warn("Failed to update SlackUser (non-fatal):", userErr?.message || userErr);
      }
    }

    // safety: prevent overwriting owner/members
    delete updates.owner;
    delete updates.members;

    const workspace = await Workspace.findByIdAndUpdate(id, updates, { new: true });
    if (!workspace) return res.status(404).json({ message: "Workspace not found" });

    console.log("Workspace updated:", workspace._id.toString(), "profileImage:", workspace.profileImage);
    return res.json({ success: true, workspace });
  } catch (err) {
    console.error("updateWorkspace error:", err.stack || err);
    if (process.env.NODE_ENV === "development") {
      return res.status(500).json({ message: "Failed to update workspace", error: err?.message || err, stack: err.stack });
    }
    return res.status(500).json({ message: "Failed to update workspace" });
  }
};
