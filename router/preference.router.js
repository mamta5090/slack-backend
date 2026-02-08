import express from 'express';
import UserPreferences from '../models/UserPreferences.js';
import User from '../models/User.js'; // Import User model

const router = express.Router();

// GET Preferences (Includes live pause status from User model)
router.get('/:userId', async (req, res) => {
  try {
    let prefs = await UserPreferences.findOne({ userId: req.params.userId });
    if (!prefs) {
      prefs = await UserPreferences.create({
        userId: req.params.userId,
        notifications: {
          messagingDefaults: { desktopNotifications: true, mobileNotifications: true, notifyAbout: "Everything" },
          alsoNotifyAbout: { threadReplies: true, vipMessages: false, newHuddles: true, activityBadgeCount: true },
          schedule: { 
            type: "Every day", 
            days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(d => ({ 
              day: d, 
              start: "09:00 AM", 
              end: "06:00 PM",
              enabled: true // Added enabled flag
            })) 
          }
        }
      });
    }

    // Get live pause status from User model
    const user = await User.findById(req.params.userId).select("notificationPausedUntil");

    res.json({
      ...prefs.toObject(),
      isPaused: user?.notificationPausedUntil ? new Date(user.notificationPausedUntil) > new Date() : false
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH Preferences (Handles custom Time and Day selection)
router.patch('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { resumeNotifications, scheduleOverrideUntil } = req.body;

    let updatedUser = null;

    if (resumeNotifications === true) {
      // Update the user model to set the override
      updatedUser = await User.findByIdAndUpdate(userId, {
        $set: { 
          notificationPausedUntil: null, 
          notificationScheduleOverrideUntil: scheduleOverrideUntil || null,
          notificationPauseMode: "everyone" 
        }
      }, { new: true }).select("-password");
    }

    const updatedPrefs = await UserPreferences.findOneAndUpdate(
      { userId },
      { $set: req.body }, 
      { new: true, upsert: true }
    );

    // CRITICAL: Return both. The frontend needs 'user' to update Redux.
    res.json({
      preferences: updatedPrefs,
      user: updatedUser 
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

export default router;