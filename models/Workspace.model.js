import mongoose from "mongoose";

const workspaceSchema=new mongoose.Schema({
    name:{type:String, required:true},
    owner:{type:mongoose.Schema.Types.ObjectId, ref:"SlackUser",required:true},
    members:[{type:mongoose.Schema.Types.ObjectId, ref:"SlackUser"}],
    createdAt:{type:Date, default:Date.now},
    profileImage:{type:String}
},{timestamps:true});

const Workspace=mongoose.model("Workspace",workspaceSchema)
export default Workspace;