import express from 'express'
import {addMember, createChannel, leaveChannel,getAllChannels, getChannelById, getChannelMessages, sendMessageToChannel, deleteMessageFromChannel, markChannelAsRead, getChannelFiles, joinChannel, getChannelThreadMessages, sendChannelReply} from '../controller/channel.controller.js'
import auth from '../middleware/auth.js'
import User from '../models/User.js'
import { uploadImage } from '../config/s3.js'
const channelRouter=express.Router()

channelRouter.post('/create',auth, createChannel)
channelRouter.post('/:channelId/members',auth,addMember)
channelRouter.delete('/:channelId/members/me',auth,leaveChannel)
channelRouter.get('/getAllChannel', auth, getAllChannels);
channelRouter.get('/:channelId', auth, getChannelById);
channelRouter.get('/:channelId/messages', auth, getChannelMessages);
channelRouter.post('/:channelId/read', auth, markChannelAsRead);
channelRouter.post('/:channelId/messages',auth,uploadImage.single('image'), sendMessageToChannel);
channelRouter.delete('/:channelId/messages/:messageId',auth,deleteMessageFromChannel);
channelRouter.get('/:channelId/files',auth,getChannelFiles)
channelRouter.post('/join', auth, joinChannel); 
channelRouter.post('/:channelId/messages/:parentId/reply', auth, uploadImage.single('image'), sendChannelReply);
channelRouter.get('/messages/:parentId/replies', auth, getChannelThreadMessages);

export default channelRouter




