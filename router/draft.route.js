import express from "express";
import auth from "../middleware/auth.js";
import { uploadImage } from "../config/s3.js";
import {
  createDraft,
  getDrafts,
  getScheduledMessages,
  getSentMessages,
  deleteDraft,
  sendDraftImmediately,
} from "../controller/draft.controller.js";

const draftRouter = express.Router();

// Create a draft or schedule a message (supports file upload)
draftRouter.post("/create", auth, uploadImage.single("image"), createDraft);

// Get lists
draftRouter.get("/drafts", auth, getDrafts);
draftRouter.get("/scheduled", auth, getScheduledMessages);
draftRouter.get("/sent", auth, getSentMessages);

// Actions
draftRouter.delete("/:draftId", auth, deleteDraft);
draftRouter.post("/:draftId/send", auth, sendDraftImmediately);

export default draftRouter;