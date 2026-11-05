const mongoose = require("mongoose");

// Atomic sequence counters (used for automatic Employee IDs)
const counterSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true,
  },

  seq: {
    type: Number,
    default: 0,
  },
});

module.exports = mongoose.model("Counter", counterSchema);
