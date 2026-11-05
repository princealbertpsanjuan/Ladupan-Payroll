const mongoose = require("mongoose");
const CashAdvance = require("../models/CashAdvance");
const { roundMoney } = require("./attendanceRules");

// Returns { [employeeId]: { totalAdvances, totalDeductions, balance } }
const getBalances = async (employeeIds = null) => {
  const match = {};

  if (employeeIds) {
    match.employee = {
      $in: employeeIds.map((id) => new mongoose.Types.ObjectId(String(id))),
    };
  }

  const rows = await CashAdvance.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$employee",
        totalAdvances: {
          $sum: { $cond: [{ $eq: ["$type", "advance"] }, "$amount", 0] },
        },
        totalDeductions: {
          $sum: { $cond: [{ $eq: ["$type", "deduction"] }, "$amount", 0] },
        },
      },
    },
  ]);

  const balances = {};

  rows.forEach((row) => {
    balances[String(row._id)] = {
      totalAdvances: roundMoney(row.totalAdvances),
      totalDeductions: roundMoney(row.totalDeductions),
      balance: roundMoney(row.totalAdvances - row.totalDeductions),
    };
  });

  return balances;
};

const getBalance = async (employeeId) => {
  const balances = await getBalances([employeeId]);

  return (
    balances[String(employeeId)] || {
      totalAdvances: 0,
      totalDeductions: 0,
      balance: 0,
    }
  );
};

module.exports = { getBalances, getBalance };
