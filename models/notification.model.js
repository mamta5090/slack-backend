import mongoose, { Schema } from 'mongoose';

const notificationSchema = new mongoose.Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['personal', 'channel', 'call', 'mention'], required: true },
  actorId: { type: Schema.Types.ObjectId, ref: 'User' },
  channelId: { type: Schema.Types.ObjectId, ref: 'Channel', default: null },
  message: { type: Schema.Types.ObjectId, ref: 'Message', default: null },
  isRead: { type: Boolean, default: false },
  title: { type: String, required: true },
  body: { type: String, required: true },
  data: Schema.Types.Mixed,
  delivered: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

notificationSchema.index({ userId: 1, delivered: 1 });
notificationSchema.index({ createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;