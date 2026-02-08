import mongoose from "mongoose";

const emailSubSchema = new mongoose.Schema({
  address: { type: String, required: true },
  token: { type: String, required: true },
  status: { type: String, enum: ["pending", "accepted", "expired"], default: "pending" },
  setAt: { type: Date, default: Date.now },
});

const inviteSchema = new mongoose.Schema(
  {
    emails: [emailSubSchema],              
    role: { type: String, enum: ["Member", "Guest", "Admin"], default: "Member" },
    channels: [{ type: String }],
    message: { type: String },
    workspace: { type: String, required: true },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export default mongoose.model("Invite", inviteSchema);