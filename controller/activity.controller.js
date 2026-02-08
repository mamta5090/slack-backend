// controllers/activity.controller.js

import mongoose from 'mongoose';
import Activity from '../models/activity.model.js';

export const getActivitiesForUser = async (req, res) => {
    try {
        const { userId, workspaceId } = req.params;
        const { unreadOnly } = req.query;

        if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(workspaceId)) {
            return res.status(400).json({ msg: 'Invalid user ID or workspace ID' });
        }

        const query = {
            userId: userId,
            workSpace: workspaceId 
        };

        if (unreadOnly === 'true') {
            query.isRead = false;
        }

        // ✅ FIX 1: Find the documents first without trying to populate dynamic refs in the same chain.
        const activities = await Activity.find(query)
            .sort({ createdAt: -1 })
            .limit(50);
            
        // ✅ FIX 2: Use the static `Model.populate()` method to handle the dynamic references correctly.
        // Mongoose will automatically read the `model` field for each document and populate from the correct collection.
        await Activity.populate(activities, [
            { path: 'actor', select: 'name profileImage' },
            { path: 'context.id', select: 'name' }, // Populate the 'id' field within the 'context' object
            { path: 'target.id', select: 'content' }   // Populate the 'id' field within the 'target' object (e.g., get message content)
        ]);

        res.status(200).json(activities);
    } catch (error) {
        console.error('Error fetching activities:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const markActivitiesAsRead = async (req, res) => {
    try {
        const { userId, workspaceId } = req.params;
        
        // ✅ FIX 3: Corrected the field name from 'workspace' to 'workSpace' to match the schema.
        await Activity.updateMany(
            { userId: userId, workSpace: workspaceId, isRead: false }, 
            { $set: { isRead: true } }
        );
        res.status(200).json({ message: 'Activities marked as read' });
    } catch (error){

        res.status(500).json({ message: 'Server error' });
    }
};

// This helper function is perfectly designed. No changes needed.
export const createActivity = async (activityData) => {
    try {
        const newActivity = new Activity(activityData);
        await newActivity.save();
        // Here, you would also emit a WebSocket event to notify the client in real-time
        // Example: emitActivityNotification(activityData.userId, newActivity);
        console.log('Activity created successfully');
    } catch (error) {
        console.error('Error creating activity:', error);
    }
};