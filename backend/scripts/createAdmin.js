const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const Admin = require("./models/Admin");

mongoose.connect("mongodb://127.0.0.1:27017/itclubpaymentsystem")
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

async function createAdmin() {
  const username = "Ddembe"; // change if you want
  const password = "julie28"; // change to a strong password

  const passwordHash = await bcrypt.hash(password, 10);

  const admin = new Admin({ username, passwordHash });
  await admin.save();
  console.log(`✅ Admin created: ${username}`);
  process.exit();
}

createAdmin();
