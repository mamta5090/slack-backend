import mongoose from "mongoose";

const fileSchema = new mongoose.Schema({
  name: String,
  url: String,
  mimetype: String,
  key: String, 
});

const messageSchema = new mongoose.Schema({
  sender: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },
  receiver: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: false 
  },
  channel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Channel',
    required: false
  },
  message: { 
    type: String, 
    default: "" ,
    trim: true,
  },
  image: {
    type: String,
    default: "",
  },
  imageKey: {
    type: String,
    default: ""
  },
  files: {
    type: [fileSchema],
    default: []
  },
  parentId:{
type:mongoose.Schema.Types.ObjectId,
ref:'Message',
default:null
  },
  replyCount:{
    type:Number,
    default:0
  },
  forwardedFrom: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "User",
  default: null
},
isForwarded: {
  type: Boolean,
  default: false
},

  
  reactions: [
  {
    emoji: String,
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  }
],
  isDeleted: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true }); 

messageSchema.pre('save', function(next) {
  if (!this.receiver && !this.channel) {
    return next(new Error('A message must have either a `receiver` or a `channel`.'));
  }
  if (this.receiver && this.channel) {
    return next(new Error('A message cannot have both a `receiver` and a `channel`.'));
  }
  next();
});

const Message = mongoose.model("Message", messageSchema);
export default Message;