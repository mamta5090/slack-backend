import mongoose from 'mongoose';

const PreferenceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  notifications: {
    messagingDefaults: {
      desktopNotifications: { type: Boolean, default: true },
      mobileNotifications: { type: Boolean, default: true },
      notifyAbout: { type: String, enum: ["Everything", "Direct messages, mentions & keywords", "Nothing"], default: "Direct messages, mentions & keywords" }
    },
    alsoNotifyAbout: {
      threadReplies: { type: Boolean, default: true },
      vipMessages: { type: Boolean, default: false },
      newHuddles: { type: Boolean, default: true },
      activityBadgeCount: { type: Boolean, default: true },
      mobileOverrides: { type: Boolean, default: false }
    },
    channelKeywords: { type: String, default: "" },
    schedule: {
      type: { type: String, default: "Every day" }, 
      days: [{
        day: String,
        start: { type: String, default: "9:00 AM" },
        end: { type: String, default: "6:00 PM" }
      }]
    },
    reminderTime: { type: String, default: "9:00 AM" },
    mobileActivity: {
      inactiveTimeout: { type: String, default: "As soon as I'm inactive" },
      summaryNotification: { type: Boolean, default: true }
    },
    sounds: {
      messageSound: { type: String, default: "Knock Brush" },
      vipSound: { type: String, default: "Knock Brush" },
      huddleSound: { type: String, default: "Boop Plus" },
      muteAllSounds: { type: Boolean, default: false }
    },
    appearance: {
      flashWindow: { type: String, enum: ["Never", "When left idle", "Always"], default: "When left idle" },
      deliveryMethod: { type: String, default: "Slack built-in notifications" }
    }
  }
});

const UserPreferences = mongoose.model('UserPreferences', PreferenceSchema);

export default UserPreferences;