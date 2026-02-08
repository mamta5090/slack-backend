// router/invite.routes.js
import express from 'express';
import { createInvite } from '../controller/invite.controller.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// require auth
router.post("/invitelink", auth, createInvite);

export default router;
