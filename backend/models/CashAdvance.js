const mongoose = require("mongoose");

// Cash advance ledger.
// - "advance":   money given to the employee (added by the Admin)
// - "deduction": amount paid back through a payroll (created by payroll generation)
// Outstanding balance = total advances - total deductions
const cashAdvanceSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    type: {
      type: String,
      enum: ["advance", "deduction"],
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },

    date: {
      type: String,
      required: true,
    },

    note: {
      type: String,
      default: "",
    },

    payrollReport: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PayrollReport",
      default: null,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

cashAdvanceSchema.index({ employee: 1, date: -1 });

module.exports = mongoose.model("CashAdvance", cashAdvanceSchema);
