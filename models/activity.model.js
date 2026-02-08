import mongoose from 'mongoose';

const activitySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    workSpace: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkSpace', required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: { 
        type: String, 
        required: true,
        enum: [
            'mentioned_you', 
            'replied_to_thread', 
            'reacted_to_message', 
            'joined_channel',
            'invitation',
        ]
    },
    contentSnippet: { type: String },
    context: {
        id: { type: mongoose.Schema.Types.ObjectId, required: true },
        model: { type: String, required: true, enum: ['Conversation', 'Channel'] }
    },
    target: {
        id: { type: mongoose.Schema.Types.ObjectId },
        model: { type: String, enum: ['Message', 'File', 'Poll'] } 
    },
    isRead: { type: Boolean, default: false, index: true }
}, { timestamps: true });

const Activity = mongoose.model('Activity', activitySchema);
export default Activity;