const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
  receiptNumber: { type: String, required: true, unique: true },
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  regNo: { type: String, required: true, trim: true },
  course: { type: String, required: true, trim: true },
  year: { type: String, required: true, enum: ["1", "2", "3", "4"], default: "1" },
  semesterType: { type: String, required: true, enum: ["First", "Second"], default: "First" },
  paymentAmount: { type: Number, required: true, min: 0 },
  date: { type: Date, required: true }
}, { timestamps: true });

module.exports = mongoose.model("Payment", paymentSchema);
