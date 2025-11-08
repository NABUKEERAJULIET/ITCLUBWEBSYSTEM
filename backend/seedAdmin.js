const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const Admin = require("./models/Admin");

// Config from env with sensible defaults for local use
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/itclubpaymentsystem";
const USERNAME = process.env.ADMIN_USERNAME || "Ddembe";
const PASSWORD = process.env.ADMIN_PASSWORD || "julie28";

async function createAdmin() {
  try {
    await mongoose.connect(MONGO_URI);

    // Avoid duplicate usernames
    const existing = await Admin.findOne({ username: USERNAME });
    if (existing) {
      console.log("ℹ️ Admin already exists:", USERNAME);
      await mongoose.disconnect();
      return process.exit(0);
    }

    const hash = await bcrypt.hash(PASSWORD, 10);
    const admin = new Admin({ username: USERNAME, passwordHash: hash });
    await admin.save();

    console.log("✅ Admin created successfully!");
    console.log("Username:", USERNAME);
    console.log("Password:", PASSWORD);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("❌ Error creating admin:", err);
    try { await mongoose.disconnect(); } catch {}
    process.exit(1);
  }
}

createAdmin();
