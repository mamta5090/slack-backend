import express from 'express';


import {  getFilesByConversation, getFilesByReceiver } from '../controller/filter.controller.js';
import auth from '../middleware/auth.js';

const filterRouter = express.Router();

// filterRouter.get("/images",filterImage)
// filterRouter.get("/documents",filterDocuments)
filterRouter.get("/conversations/:conversationId/files",getFilesByConversation)
filterRouter.get("/user/:receiverId/files", auth, getFilesByReceiver);

export default filterRouter;
