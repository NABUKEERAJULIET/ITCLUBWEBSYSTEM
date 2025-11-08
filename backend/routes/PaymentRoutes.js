const express = require("express");
const router = express.Router();
const Payment = require("../models/PaymentModel");

// GET all payments
router.get("/", async (req, res) => {
  try {
    const payments = await Payment.find().sort({ createdAt: -1 });
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE a payment
router.post("/", async (req, res) => {
  try {
    const count = await Payment.countDocuments();
    const newPayment = new Payment({
      ...req.body,
      receiptNumber: `REC${count + 1}`
    });
    await newPayment.save();
    res.status(201).json(newPayment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// UPDATE payment
router.put("/:id", async (req, res) => {
  try {
    const updated = await Payment.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE payment
router.delete("/:id", async (req, res) => {
  try {
    await Payment.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
