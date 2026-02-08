import mongoose from "mongoose";

const draftSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    channel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Channel",
    },
    message: {
      type: String,
      default: "",
    },
    files: [
      {
        name: String,
        url: String,
        mimetype: String,
        key: String,
      },
    ],

    image: { type: String },
    imageKey: { type: String },
    
    scheduledAt: {
      type: Date, 
      default: null,
    },
  },
  { timestamps: true }
);

const Draft = mongoose.model("Draft", draftSchema);
export default Draft;