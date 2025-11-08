const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const Admin = require("../models/Admin");

const JWT_SECRET = process.env.JWT_SECRET || "change_this_secret_to_env_value";

// ===== Login Route =====
router.post(
  "/login",
  [
    body("username").trim().notEmpty().withMessage("Username is required"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const username = String(req.body.username || "").trim();
    const password = req.body.password;

    // Find admin by username
    const admin = await Admin.findOne({ username });
    if (!admin) {
      console.warn("[auth] login user not found:", username);
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Compare password
    const isValid = await bcrypt.compare(password, admin.passwordHash);
    if (!isValid) {
      console.warn("[auth] password mismatch for user:", username);
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: admin._id, username: admin.username },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.json({ token, username: admin.username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Login failed" });
  }
}
);

module.exports = router;
