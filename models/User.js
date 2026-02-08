import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    displayName: { type: String, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    profileImage: { type: String, default: "" },
    role: { type: String, default: "" },
    number: { type: String, default: "" },
    location: { type: String, default: "" },
    namePronunciation: { type: String, default: "" },
    date: { type: Date },
    title: { type: String, default: "" },
    topic: { type: String },
    
  
    status: {
      text: { type: String, default: "" },
      emoji: { type: String, default: "" }, 
      expiryTime: { type: Date, default: null },
      pauseNotifications: { type: Boolean, default: false }
    },


notificationPausedUntil: {
  type: Date,
  default: null
},
notificationPauseMode: {
  type: String,
  enum: ['everyone', 'except_vips'],
  default: 'everyone'
},
    vips: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  },
  { timestamps: true }
);


userSchema.methods.cleanExpiredStatus = function() {
    const now = new Date();

    // Clear status if expired
    if (this.status && this.status.expiryTime && this.status.expiryTime < now) {
        this.status = { text: "", emoji: "", expiryTime: null, pauseNotifications: false };
    }

    // Clear manual pause if expired
    if (this.notificationPausedUntil && this.notificationPausedUntil < now) {
        this.notificationPausedUntil = null;
    }

    // Clear schedule override ONLY if the override date (tomorrow 9am) has passed
    if (this.notificationScheduleOverrideUntil && this.notificationScheduleOverrideUntil < now) {
        this.notificationScheduleOverrideUntil = null;
    }

    return this.save();
};

const User = mongoose.model("User", userSchema);
export default User;