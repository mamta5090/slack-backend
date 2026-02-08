import express from 'express'
import { createWorkspace, inviteToWorkspace, updateWorkspace } from '../controller/workspace.controller.js';
import auth from '../middleware/auth.js';
import {upload} from '../middleware/multer.js'
const workspaceRouter = express.Router();

workspaceRouter.post("/createworkspace", auth, createWorkspace);
workspaceRouter.post("/:id/invite", auth, inviteToWorkspace);
workspaceRouter.patch("/:id", auth, upload.single("profileImage"), updateWorkspace);

export default workspaceRouter;
