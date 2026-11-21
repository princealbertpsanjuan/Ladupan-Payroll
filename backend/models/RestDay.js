const mongoose = require("mongoose");

// A rest day the admin scheduled for an employee (one document per date).
// Every month starts blank: a day without a rest-day entry is a work day.
const restDaySchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // YYYY-MM-DD (Philippine date)
    date: {
      type: String,
      required: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

restDaySchema.index({ employee: 1, date: 1 }, { unique: true });
restDaySchema.index({ date: 1 });

module.exports = mongoose.model("RestDay", restDaySchema);
