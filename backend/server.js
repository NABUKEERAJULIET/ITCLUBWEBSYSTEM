// ===== Import Dependencies =====
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const { body, validationResult } = require("express-validator");

// ===== Models =====
const Admin = require("./models/Admin");
const Payment = require("./models/PaymentModel");
const Counter = require("./models/Counter");

// ===== Middleware =====
const verifyToken = require("./middleware/auth").verifyToken;

// ===== Routes =====
const authRouter = require("./routes/auth"); // auth routes (login)

// ===== Initialize App =====
const app = express();
const PORT = process.env.PORT || 5002;

// ===== Middleware =====
app.use(cors());
app.use(express.json());
app.use("/api/auth", authRouter); // use auth routes

// ===== MongoDB Connection =====
mongoose
  .connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/itclubpaymentsystem")
  .then(async () => {
    console.log("✅ MongoDB Connected");
    if (process.env.SEED_ADMIN === "true") {
      await ensureAdmin();
    }
    await fixOldIndexes();
    await initReceiptCounter();
  })
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// ===== Ensure Default Admin Exists =====
async function ensureAdmin() {
  const count = await Admin.countDocuments();
  if (count === 0) {
    const bcrypt = require("bcrypt");
    const hash = await bcrypt.hash("julie28", 10);
    const admin = new Admin({ username: "Ddembe", passwordHash: hash });
    await admin.save();
    console.log("✅ Default admin created: Ddembe / julie28");
  }
}

// ===== Helpers =====
async function generateUniqueReceiptNumber() {
  const c = await Counter.findOneAndUpdate(
    { key: "receiptNumber" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  const n = c.seq;
  const formatted = `F-${String(n).padStart(4, "0")}`;
  return formatted;
}

async function fixOldIndexes() {
  try {
    const indexes = await Payment.collection.indexes();
    const legacy = indexes.find((i) => i.name === "receiptNo_1");
    if (legacy) {
      await Payment.collection.dropIndex("receiptNo_1");
    }
    await Payment.syncIndexes();
  } catch (e) {
    console.error("Index sync error:", e.message);
  }
}

// Initialize the sequential receipt counter based on existing F-#### receipts
async function initReceiptCounter() {
  try {
    const existing = await Counter.findOne({ key: "receiptNumber" });
    if (existing && existing.seq > 0) return;

    let maxNum = 0;
    const cursor = Payment.find({ receiptNumber: { $regex: /^F-\d+$/ } }, { receiptNumber: 1 })
      .lean()
      .cursor();
    for await (const doc of cursor) {
      const n = parseInt(String(doc.receiptNumber).replace(/^F-/, ""), 10);
      if (!Number.isNaN(n)) maxNum = Math.max(maxNum, n);
    }
    // Fallback: if no F-#### found, keep 0 so next becomes F-0001
    await Counter.updateOne({ key: "receiptNumber" }, { $set: { seq: maxNum } }, { upsert: true });
  } catch (e) {
    console.error("initReceiptCounter error:", e.message);
  }
}

// ===== Payment Routes =====
app.get("/api/payments", verifyToken, async (req, res) => {
  const payments = await Payment.find().lean();
  const normalized = payments.map((p) => ({
    ...p,
    // Legacy support
    receiptNumber: p.receiptNumber || p.receiptNo || p.receipt || p.receipt_number || null,
    paymentAmount:
      typeof p.paymentAmount === "number"
        ? p.paymentAmount
        : typeof p.payment === "number"
        ? p.payment
        : 0,
    firstName:
      p.firstName || (typeof p.studentName === "string" ? p.studentName.split(" ")[0] : p.firstName),
    lastName:
      p.lastName || (typeof p.studentName === "string" ? p.studentName.split(" ").slice(1).join(" ") : p.lastName),
  }));
  res.json(normalized);
});

app.post(
  "/api/payments",
  verifyToken,
  [
    body("firstName").trim().notEmpty(),
    body("lastName").trim().notEmpty(),
    body("regNo").trim().notEmpty(),
    body("course").trim().notEmpty(),
    body("year").isIn(["1", "2", "3", "4"]),
    body("semesterType").isIn(["First", "Second"]),
    body("paymentAmount").isFloat({ gt: 0 }).toFloat(),
    body("date").isISO8601().toDate(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const payload = { ...req.body };
      if (!payload.receiptNumber) {
        payload.receiptNumber = await generateUniqueReceiptNumber();
      }
      const newPayment = new Payment(payload);
      let saved;
      try {
        saved = await newPayment.save();
      } catch (err) {
        if (err && err.code === 11000 && err.keyPattern && err.keyPattern.receiptNumber) {
          newPayment.receiptNumber = await generateUniqueReceiptNumber();
          saved = await newPayment.save();
        } else {
          throw err;
        }
      }
      res.status(201).json(saved);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

app.put("/api/payments/:id", verifyToken, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ error: "Payment not found" });
    const updates = { ...req.body };
    if (Object.prototype.hasOwnProperty.call(updates, "receiptNumber")) {
      delete updates.receiptNumber; // do not allow changing receipt number
    }
    Object.assign(payment, updates);
    const updated = await payment.save();
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete("/api/payments/:id", verifyToken, async (req, res) => {
  try {
    const deleted = await Payment.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Payment not found" });
    res.json({ message: "Payment deleted successfully" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ===== Generate Receipt =====
app.get("/api/payments/:id/receipt", verifyToken, async (req, res) => {
  try {
    const idOrReceipt = req.params.id;
    let payment = null;

    try {
      payment = await Payment.findById(idOrReceipt);
    } catch {
      // not a valid ObjectId, search by receipt number fields
      payment =
        (await Payment.findOne({ receiptNumber: idOrReceipt })) ||
        (await Payment.findOne({ receiptNo: idOrReceipt })) ||
        (await Payment.findOne({ receipt: idOrReceipt })) ||
        (await Payment.findOne({ receipt_number: idOrReceipt }));
    }

    if (!payment) return res.status(404).send("Payment not found");

    const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Receipt ${payment.receiptNumber || payment.receiptNo || payment.receipt || payment.receipt_number}</title>
<style>
body { font-family: Arial, Helvetica, sans-serif; padding: 20px; }
.header { text-align: center; }
.details { margin-top: 20px; }
.field { margin: 6px 0; }
.total { font-weight: bold; margin-top: 12px; }
.print-only { margin-top: 20px; }
</style>
</head>
<body>
<div class="header">
<h2>Bugema University IT Club</h2>
<p>Payment Receipt</p>
</div>
<div class="details">
<div class="field">Receipt No: ${payment.receiptNumber || payment.receiptNo || payment.receipt || payment.receipt_number}</div>
<div class="field">Date: ${new Date(payment.date).toLocaleString()}</div>
<div class="field">Student: ${payment.firstName} ${payment.lastName}</div>
<div class="field">Reg No: ${payment.regNo}</div>
<div class="field">Course: ${payment.course}</div>
<div class="field">Year: ${payment.year}</div>
<div class="field">Semester: ${payment.semesterType}</div>
<div class="total">Amount Paid: ${payment.paymentAmount} UGX</div>
</div>
<div class="print-only">
<button onclick="window.print()">Print Receipt</button>
</div>
</body>
</html>`;

    res.set("Content-Type", "text/html");
    res.send(html);
  } catch (err) {
    res.status(500).send("Error generating receipt: " + err.message);
  }
});

// ===== Dashboard =====
app.get("/api/dashboard", verifyToken, async (req, res) => {
  try {
    const totalPayments = await Payment.countDocuments();
    const totalAmountAgg = await Payment.aggregate([
      {
        $project: {
          amount: { $ifNull: ["$paymentAmount", "$payment"] },
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const totalAmount = totalAmountAgg[0]?.total || 0;

    res.json({ totalPayments, totalAmount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error generating dashboard data" });
  }
});

// ===== Root =====
app.get("/", (req, res) => {
  res.send("Backend is running. Use /api/auth/login, /api/payments, /api/dashboard.");
});

// ===== Start Server =====
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
