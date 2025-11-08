const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const Admin = require("./models/Admin");

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/itclubpaymentsystem";
const USERNAME = process.env.ADMIN_USERNAME || "Ddembe";
const PASSWORD = process.env.ADMIN_PASSWORD || "julie28";

async function resetAdmin() {
  try {
    await mongoose.connect(MONGO_URI);
    await Admin.deleteMany({});
    const hash = await bcrypt.hash(PASSWORD, 10);
    const admin = new Admin({ username: USERNAME, passwordHash: hash });
    await admin.save();
    console.log("✅ Admin reset successfully:");
    console.log("Username:", USERNAME);
    console.log("Password:", PASSWORD);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("❌ Failed to reset admin:", err);
    try { await mongoose.disconnect(); } catch {}
    process.exit(1);
  }
}

resetAdmin();
