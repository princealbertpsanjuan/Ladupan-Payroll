const mongoose = require("mongoose");

const payrollReportSchema = new mongoose.Schema(
  {
    payrollPeriodStart: {
      type: String,
      required: true,
    },

    payrollPeriodEnd: {
      type: String,
      required: true,
    },

    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    employees: [
      {
        employee: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },

        employeeName: String,

        // Snapshot of the Employee ID (e.g. LDP-0001) for payslips
        employeeCode: {
          type: String,
          default: "",
        },

        hourlyRate: {
          type: Number,
          default: 0,
        },

        totalPresent: Number,
        totalLate: Number,
        totalAbsent: Number,

        totalIncomplete: {
          type: Number,
          default: 0,
        },

        totalLateMinutes: {
          type: Number,
          default: 0,
        },

        totalHours: Number,

        grossSalary: Number,

        // Kept for older reports. New payrolls do not charge a separate
        // late deduction (lateness already reduces paid hours), so this is 0.
        lateDeductions: {
          type: Number,
          default: 0,
        },

        cashAdvance: {
          type: Number,
          default: 0,
        },

        otherDeductions: {
          type: Number,
          default: 0,
        },

        otherDeductionsNote: {
          type: String,
          default: "",
        },

        netSalary: Number,
      },
    ],

    totalEmployees: {
      type: Number,
      default: 0,
    },

    totalGross: {
      type: Number,
      default: 0,
    },

    totalNet: {
      type: Number,
      default: 0,
    },

    generatedDate: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "PayrollReport",
  payrollReportSchema
);