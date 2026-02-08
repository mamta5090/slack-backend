// middleware/auth.js (dev only)
import jwt from "jsonwebtoken";

const auth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    let token = null;

    if (authHeader && authHeader.startsWith("Bearer ")) token = authHeader.split(" ")[1];
    else if (req.cookies && req.cookies.token) token = req.cookies.token;

    if (process.env.NODE_ENV === "development") {
      console.log(">>> auth header preview:", authHeader ? authHeader.slice(0,60) + "..." : "no header");
      console.log(">>> token length:", token ? token.length : "no token");
      console.log(">>> JWT_SECRET present:", !!process.env.JWT_SECRET);
    }

    if (!token) return res.status(401).json({ message: "Authentication token missing" });

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "dev_secret_key");
      req.userId = decoded.id;
      req.userPayload = decoded;
      if (process.env.NODE_ENV === "development") console.log("🔐 jwt decoded:", decoded);
      return next();
    } catch (err) {
      console.error("🔐 jwt.verify error:", err.name, err.message);
      return res.status(401).json({ message: err.name === "TokenExpiredError" ? "Token expired" : "Invalid token" });
    }
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(500).json({ message: "Server error in auth middleware" });
  }
};

export default auth;
