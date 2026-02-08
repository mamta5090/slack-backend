import Invite from "../models/Invite.js";
import crypto from "crypto";
import sendInviteEmail from "../config/Mail.js";
import User from "../models/User.js";

export const createInvite = async (req, res) => {
  try {
    console.log("Incoming invite request body:", req.body);
    const { emails, role, channels, message, workspace } = req.body;
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ error: "At least one email is required." });
    }
    const emailObjs = emails.map((email) => {
      const token = crypto.randomBytes(20).toString("hex");
      return { address: email, token, status: "pending", sentAt: null };
    });
    const invite = await Invite.create({
      emails: emailObjs,
      role,
      channels,
      message,
      workspace,
      invitedBy: req.userId || null,
    });
    const frontendBase = process.env.FRONTEND_URL || "http://localhost:5173"; 
    const inviterName = req.name || "Someone"; 
    const sendPromises = invite.emails.map((e) => {
      const link = `${frontendBase}/invite/accept?token=${e.token}&email=${encodeURIComponent(e.address)}`;
      return sendInviteEmail({
        to: e.address,
        inviterName,
        workspace,
        inviteLink: link,
        customMessage: message || "",
      }).then(info => ({ status: "fulfilled", email: e.address, info }))
        .catch(err => ({ status: "rejected", email: e.address, error: err.message || err }));
    });
    const results = await Promise.allSettled(sendPromises);
    const updateOps = [];
    results.forEach((r) => {
      if (r.status === "fulfilled" && r.value?.status === "fulfilled") {
        updateOps.push(
          Invite.updateOne(
            { "_id": invite._id, "emails.address": r.value.email },
            { $set: { "emails.$.sentAt": new Date(), "emails.$.status": "pending" }}
          )
        );
      } else if (r.status === "fulfilled" && r.value?.status === "rejected") {
        console.error("Mail send rejected for:", r.value.email, r.value.error);
      } else if (r.status === "rejected") {
        console.error("Mail promise rejected", r);
      }
    });
    if (updateOps.length) await Promise.all(updateOps);
    const sendSummary = results.map((r) => {
      if (r.status === "fulfilled") return { email: r.value?.email, result: r.value?.status };
      return { email: null, result: "error", detail: r.reason };
    });
    return res.status(201).json({
      message: "Invites processed (check sendSummary for per-email status)",
      invite,
      sendSummary,
    });
  } catch (err) {
    console.error("Invite error:", err);
    return res.status(500).json({ error: "Server error while creating invites." });
  }
};
