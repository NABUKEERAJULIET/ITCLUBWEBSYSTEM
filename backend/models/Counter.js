const mongoose = require("mongoose");

const counterSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  seq: { type: Number, required: true, default: 0 },
});

module.exports = mongoose.model("Counter", counterSchema);
