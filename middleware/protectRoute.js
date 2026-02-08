import jwt from "jsonwebtoken";
import User from "../models/User.js";

// Updated to accept Authorization: Bearer <token> OR cookies (jwt/token)
const protectRoute = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    let token = null;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    } else if (req.cookies?.jwt) {
      token = req.cookies.jwt;
    } else if (req.cookies?.token) {
      token = req.cookies.token;
    }

    if (!token) return res.status(401).json({ message: "Unauthorized" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select("-password");
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    next();
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized" });
  }
};

export default protectRoute;
