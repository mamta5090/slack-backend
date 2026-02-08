import User from "../models/User.js"; 
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import UserPreferences from "../models/UserPreferences.js";

export const register = async (req, res) => {
  const { name, email, password } = req.body;
  console.log('>>> Register request body:', req.body);

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email and password are required' });
  }

  try {
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: "User already exists" });
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    user = await User.create({
      name,
      email,
      password: hashedPassword,
    });
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });
    res.status(201).json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const login = async (req, res) => {
  try {
    console.log(">>> LOGIN HIT - body:", req.body);
    const { email, password } = req.body || {};

    if (!email || !password) {
      console.warn("Login validation failed - missing fields");
      return res.status(400).json({ message: "Email and password required" });
    }

    const user = await User.findOne({ email });
    console.log(">>> User lookup result:", !!user, user ? user._id : null);

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    console.log(">>> bcrypt.compare result:", isMatch);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid password" });
    }
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({
      token,
      user: { _id: user._id, name: user.name, email: user.email,profileImage:user.profileImage },
    });
  } catch (err) {
    console.error("LOGIN ERROR (stack):", err && err.stack ? err.stack : err);
    res.status(500).json({ message: "Server error during login" });
  }
};

export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
     await user.cleanExpiredStatus();
    res.status(200).json(user);
  } catch (error) {
    console.error("GetMe Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const logOut = async (req, res) => {
  try {
    res.clearCookie("token", {
      httpOnly: true,
      secure: true, 
      sameSite: "None",
    });

    return res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error logging out" });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}, "-password");
    
    // Get current time
    const now = new Date();

    // Map through users to mask expired statuses visually without hitting DB excessively
    const usersWithCleanStatus = users.map(user => {
      // Convert to object to modify it safely before sending
      const userObj = user.toObject(); 

      if (userObj.status && userObj.status.expiryTime) {
        if (new Date(userObj.status.expiryTime) < now) {
           // If expired, send empty status to frontend
           userObj.status = {
             text: "",
             emoji: "",
             expiryTime: null,
             pauseNotifications: false
           };
        }
      }
      return userObj;
    });

    // Optional: Log headers if needed, otherwise remove console.log(req.headers)
    res.status(200).json(usersWithCleanStatus);
  } catch (error) {
    res.status(500).json({ message: "Error fetching users", error: error.message });
  }
};

export const getSingleUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    
    // Check expiry logic here using the model method
    // This ensures that if the status has expired, it clears it before sending the response
    await user.cleanExpiredStatus(); 

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const editProfile = async (req, res) => {
    try {
        if (req.userId !== req.params.id) {
            return res.status(403).json({ message: "Forbidden: You can only edit your own profile." });
        }
        const { name, displayName, role, number, location, namePronunciation, email, date,title,topic  } = req.body;
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        user.name = name || user.name;
        user.displayName = displayName || user.displayName;
        user.role = role || user.role;
        user.number = number || user.number;
        user.location = location || user.location;
        user.namePronunciation = namePronunciation || user.namePronunciation;
        user.email = email || user.email;
        user.date = date || user.date;
         user.title = title || user.title; 
         user.topic=topic || user.topic;
        if (req.file) {
            user.profileImage = `uploads/${req.file.filename}`;
        }
        const updatedUser = await user.save();
        return res.status(200).json(updatedUser);
    } catch (error) {
        console.error("editProfile error:", error);
        return res.status(500).json({ message: `editProfile error: ${error.message}` });
    }
};

export const getProfile=async(req,res)=>{
  try {
    const {userName}=req.params;
    const user=await User.findOne({userName}).select("-password")
  if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    await user.cleanExpiredStatus();
 return res.status(200).json(user)
  }catch (error) {
    return res.status(500).json({message:`edit prfile error ${error}`})
  }
}

export const setStatus=async(req,res)=>{
  try{
    const userId = req.userId || req.user.id || req.user._id; 
    const {text,emoji,expiryTime,pauseNotifications}=req.body;
    const user=await User.findById(userId);
    if(!user) return res.status(404).json({message:"User not found"})

      user.status={
        text:text || "",
        emoji:emoji || "",
        expiryTime:expiryTime || null,
        pauseNotifications:pauseNotifications || false
      }

      await user.save();
      res.status(200).json({
        success:true,
        message:"Status update",
        user
      })
      console.log(user)
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
}

export const clearStatus = async (req, res) => {
  try {
    const userId = req.userId || req.user.id; 
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "user not found" });

    // Clear everything: Status, Manual Pause, and Schedule Overrides
    user.status = { text: "", emoji: "", expiryTime: null, pauseNotifications: false };
    user.notificationPausedUntil = null;
    user.notificationScheduleOverrideUntil = null; // Clear override
    user.notificationPauseMode = "everyone";
    
    await user.save();

    const preferences = await UserPreferences.findOne({ userId });

    res.status(200).json({ 
      success: true, 
      message: "Status cleared and notifications resumed", 
      user,
      preferences 
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};


export const pauseNotifications = async (req, res) => {
  try {
    const userId = req.userId; 
    const { duration, customIsoDate, mode, pauseMode, scheduleOverrideUntil } = req.body;

    let updateData = {};

    if (mode === "resume") {
      updateData = {
        notificationPausedUntil: null,
        // If the frontend calculated a time to ignore the schedule until, save it here
        notificationScheduleOverrideUntil: scheduleOverrideUntil || null, 
        notificationPauseMode: "everyone", 
      };
    } else {
      let untilDate = duration 
        ? new Date(Date.now() + duration * 60 * 1000)
        : (customIsoDate ? new Date(customIsoDate) : new Date(Date.now() + 60 * 60 * 1000));

      updateData = {
        notificationPausedUntil: untilDate,
        notificationScheduleOverrideUntil: null, // Reset override when manually pausing
        notificationPauseMode: pauseMode || "everyone", 
      };
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true } 
    ).select("-password");

    const preferences = await UserPreferences.findOne({ userId });

    return res.status(200).json({
      success: true,
      message: mode === "resume" ? "Notifications resumed" : "Notifications paused",
      user: updatedUser,
      preferences
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};