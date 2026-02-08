import mongoose from 'mongoose';

const channelSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true,
  },
//   sender:{
// type: mongoose.Schema.Types.ObjectId,
// ref: 'User',
// required: true,
//   },
//   receiver:{
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: false,
//       },
  visibility: {
    type: String,
    enum: ['public', 'private'],
    default: 'public',
  },
  description: {
    type: String,
    trim: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
   managedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  unreadCounts: {
    type: Map,
    of: Number,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Channel = mongoose.model('Channel', channelSchema);

export default Channel