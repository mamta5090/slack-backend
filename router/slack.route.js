// routes/slack.routes.js
import express from 'express';
import {
  getMe, SendOtp, Signin, SlackLogin, updateProfile, VerifyOtp, uploadPhoto
} from '../controller/slackUser.controller.js';
import { upload } from '../middleware/multer.js';
import auth from '../middleware/auth.js';

const slackRouter = express.Router();

slackRouter.post("/signin", Signin);
slackRouter.post("/slacklogin", SlackLogin);
slackRouter.post("/sendotp", SendOtp);
slackRouter.post('/verifyotp', VerifyOtp);

slackRouter.get("/me", auth, getMe);
slackRouter.post("/profile", auth, updateProfile);
slackRouter.post("/photo", auth, upload.single("photo"), uploadPhoto);

export default slackRouter;
