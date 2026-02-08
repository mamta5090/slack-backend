import Conversation from "../models/conversation.model.js";
export const getMyConversations = async (req, res) => {
  try {
    const me = req.userId;
    const convos = await Conversation.find({ participants: me })
      .sort({ updatedAt: -1 })
      .populate("participants", "name email profilePic");

    const data = convos.map((c) => {
      const other = c.participants.find((p) => String(p._id) !== String(me));
      const unreadCount = Number(c.unreadCounts?.get?.(String(me)) || 0);
      return {
        _id: c._id,
        other,
        unreadCount,
        updatedAt: c.updatedAt,
      };
    });

    res.json(data);
  } catch (err) {
    console.error("getMyConversations error:", err);
    res.status(500).json({ message: "Failed to fetch conversations" });
  }
};

// POST /api/conversation/read/:otherUserId
export const markAsRead = async (req, res) => {
  try {
    const me = req.userId;
    const otherUserId = req.params.otherUserId;

    const convo = await Conversation.findOne({
      participants: { $all: [me, otherUserId] },
    });

    if (!convo)
      return res.status(404).json({ message: "Conversation not found" });

    convo.unreadCounts.set(String(me), 0);
    await convo.save();
    res.json({ ok: true });
  } catch (err) {
    console.error("markAsRead error:", err);
    res.status(500).json({ message: "Failed to mark as read" });
  }
};

export const createOrGetConversation = async (req, res) => {
  try {
    const { senderId, receiverId } = req.body;

    if (!senderId || !receiverId) {
      return res
        .status(400)
        .json({ message: "senderId and receiverId required" });
    }

    let convo = await Conversation.findOne({
      participants: { $all: [senderId, receiverId] },
    });

    if (!convo) {
      convo = await Conversation.create({
        participants: [senderId, receiverId],
        lastMessageAt: new Date(),
      });
    }

    res.status(201).json(convo);
  } catch (err) {
    console.error("createOrGetConversation error:", err);
    res
      .status(500)
      .json({ message: err.message || "Failed to create/get conversation" });
  }
};

export const getUserConversations = async (req, res) => {
  try {
    const { userId } = req.params;

    const conversations = await Conversation.find({
      participants: { $in: [userId] },
    })
      .sort({ updatedAt: -1 })
      .populate("participants", "name email");

    res.json(conversations);
  } catch (err) {
    console.error("getUserConversations error:", err);
    res
      .status(500)
      .json({ message: err.message || "Failed to fetch conversations" });
  }
};

export const getConversationById = async (req, res) => {
  try {
    const convo = await Conversation.findById(req.params.id).populate(
      "participants",
      "name email"
    );
    if (!convo)
      return res.status(404).json({ message: "Conversation not found" });
    res.json(convo);
  } catch (err) {
    console.error("getConversationById error:", err);
    res
      .status(500)
      .json({ message: err.message || "Failed to fetch conversation" });
  }
};


export const updateConversationTopic = async (req, res) => {
  try {
    // [CORRECTION]: Get the other user's ID from params
    const { otherUserId } = req.params;
    const { topic } = req.body;
    const loggedInUserId = req.userId; // from auth middleware (assuming it sets req.userId)

    // [CORRECTION]: Find the conversation using the participants array
    const conversation = await Conversation.findOne({
      participants: { $all: [loggedInUserId, otherUserId] },
    });

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    // The security check is implicitly handled by the query above, but an explicit check is still good practice.
    if (!conversation.participants.includes(loggedInUserId)) {
        return res.status(403).json({ message: "Forbidden: You are not part of this conversation" });
    }

    // Update the topic and save
    conversation.topic = topic;
    await conversation.save();

    res.status(200).json(conversation);
  } catch (error) {
    console.error("Error in updateConversationTopic: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};


export const createGroupConversation = async (req, res) => {
  console.log("--- [API] POST /api/conversation/group HIT ---");
  try {
    const { participantIds, groupName } = req.body;
    
    // --- [THE FIX IS ON THIS LINE] ---
    // Change `req.user._id` to `req.userId` to match what your middleware provides.
    const loggedInUserId = req.userId; 

    // --- VALIDATE THE LOGGED-IN USER ---
    if (!loggedInUserId) {
      console.error("CRITICAL: req.userId is missing. Auth middleware might have failed.");
      return res.status(401).json({ message: "Unauthorized: User ID not found in token." });
    }
    console.log("Logged-in User ID:", loggedInUserId);

    // --- VALIDATE PARTICIPANT IDs ---
    if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
      return res.status(400).json({ message: "Participant IDs are required and must be an array." });
    }
    console.log("Incoming Participant IDs:", participantIds);

    // Combine and ensure no duplicates
    const allParticipants = [...new Set([loggedInUserId.toString(), ...participantIds])];
    console.log("Final Participants Array for DB:", allParticipants);

    // A group must have at least 3 people
    if (allParticipants.length < 3) {
      return res.status(400).json({ message: "A group conversation must have at least 3 participants." });
    }

    // --- CREATE CONVERSATION ---
    console.log("Attempting to create conversation in database...");
    const newGroup = await Conversation.create({
      participants: allParticipants,
      isGroup: true,
      groupName: groupName || "",
    });
    console.log("Conversation created successfully. ID:", newGroup._id);
    
    // Populate details to send back
    const populatedGroup = await Conversation.findById(newGroup._id)
                                    .populate("participants", "name profileImage email"); 

    if (!populatedGroup) {
      return res.status(500).json({ message: "Failed to retrieve the group after creation." });
    }

    res.status(201).json(populatedGroup);

  } catch (error) {
    console.error("--- 💥 CRASH IN createGroupConversation 💥 ---");
    console.error("Error Message:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const markConversationAsRead = async (req, res) => {
    try {
        const currentUserId = req.userId; // From auth middleware
        const otherUserId = req.params.id; // From URL params

        // 1. Find the conversation between these two users
        const conversation = await Conversation.findOne({
            participants: { $all: [currentUserId, otherUserId] },
        });

        if (!conversation) {
             return res.status(404).json({ message: "Conversation not found" });
        }

        // 2. Reset the count using Mongoose Map syntax
        // Assuming your schema has `unread` as a Map
        if (conversation.unread) {
            conversation.unread.set(String(currentUserId), 0);
        } else if (conversation.unreadCounts) {
            // Fallback if you named the field 'unreadCounts' in your schema
            conversation.unreadCounts.set(String(currentUserId), 0);
        }

        // 3. Save the changes to DB
        await conversation.save();

        res.status(200).json({ message: "Conversation marked as read" });
    } catch (error) {
        console.error("markConversationAsRead error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};