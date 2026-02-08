import express from 'express';
import { createActivity, getActivitiesForUser,markActivitiesAsRead } from '../controller/activity.controller.js';
import auth from '../middleware/auth.js'

const activityRouter=express.Router();


activityRouter.get(
    '/user/:userId/workspace/:workspaceId', 
    auth,
    getActivitiesForUser
);
activityRouter.patch(
    '/user/:userId/workspace/:workspaceId/mark-read', 
    auth, 
    markActivitiesAsRead
);
activityRouter.post('/create-activity',createActivity);

export default activityRouter;