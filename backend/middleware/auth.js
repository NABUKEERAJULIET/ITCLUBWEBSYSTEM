const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || "change_this_secret_to_env_value";

// Middleware to verify JWT
function verifyToken(req, res, next) {
  const header = req.headers["authorization"] || req.headers["Authorization"]; 
  if (!header) {
    return res.status(401).json({ message: "Missing Authorization header" });
  }
  const parts = header.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return res.status(401).json({ message: "Authorization header must be in the format: Bearer <token>" });
  }
  const token = parts[1];

  if (!JWT_SECRET || JWT_SECRET === "change_this_secret_to_env_value") {
    return res.status(500).json({ message: "Server misconfiguration: JWT secret not set" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expired" });
    }
    return res.status(401).json({ message: "Invalid token" });
  }
}

module.exports = { verifyToken };
