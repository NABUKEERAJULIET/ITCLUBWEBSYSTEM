// Migrate legacy receipt fields to sequential format F-0001
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mongoose = require("mongoose");

const Payment = require("../models/PaymentModel");
const Counter = require("../models/Counter");

async function ensureCounterFromExisting() {
  // Initialize the counter to max existing F-#### in receiptNumber
  const cursor = Payment.find({ receiptNumber: { $regex: /^F-\d+$/ } }, { receiptNumber: 1 }).lean().cursor();
  let maxNum = 0;
  for await (const doc of cursor) {
    const n = parseInt(String(doc.receiptNumber).replace(/^F-/, ""), 10);
    if (!Number.isNaN(n)) maxNum = Math.max(maxNum, n);
  }
  await Counter.updateOne({ key: "receiptNumber" }, { $set: { seq: maxNum } }, { upsert: true });
}

async function nextReceipt() {
  const c = await Counter.findOneAndUpdate(
    { key: "receiptNumber" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `F-${String(c.seq).padStart(4, "0")}`;
}

async function run() {
  const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/itclubpaymentsystem";
  await mongoose.connect(uri);
  console.log("Connected to", uri);

  // Drop legacy unique index if present
  try {
    const idx = await Payment.collection.indexes();
    if (idx.find((i) => i.name === "receiptNo_1")) {
      await Payment.collection.dropIndex("receiptNo_1");
      console.log("Dropped legacy index receiptNo_1");
    }
  } catch (e) {
    console.warn("Index check error:", e.message);
  }

  await ensureCounterFromExisting();

  // Find payments missing standardized receiptNumber (including legacy receiptNo)
  const cursor = Payment.find({
    $or: [
      { receiptNumber: { $exists: false } },
      { receiptNumber: { $type: 10 } }, // null
      { receiptNumber: { $not: /^F-\d+$/ } },
    ],
  }).cursor();

  let updated = 0;
  for await (const p of cursor) {
    try {
      // Assign new sequential receipt number without validating other fields
      const newRn = await nextReceipt();
      await Payment.updateOne({ _id: p._id }, { $set: { receiptNumber: newRn } });
      updated += 1;
    } catch (e) {
      console.error("Failed to update", p._id.toString(), e.message);
    }
  }

  console.log(`Migration complete. Updated ${updated} payments.`);
  await mongoose.disconnect();
}

run().catch(async (e) => {
  console.error(e);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
