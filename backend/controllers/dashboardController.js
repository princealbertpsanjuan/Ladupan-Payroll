const User = require("../models/User");
const Attendance = require("../models/Attendance");
const PayrollReport = require("../models/PayrollReport");
const CorrectionRequest = require("../models/CorrectionRequest");
const { getBalances, getBalance } = require("../utils/cashAdvanceUtils");
const { roundMoney } = require("../utils/attendanceRules");
const { getToday } = require("../utils/timeUtils");

// Incomplete = timed in, no time-out, and not Absent
const INCOMPLETE_FILTER = {
  isArchived: false,
  timeIn: { $ne: null },
  timeOut: null,
  remarks: { $ne: "Absent" },
};

exports.getAdminDashboard = async (req, res) => {
  try {
    const today = getToday();

    const [
      activeDTR,
      totalEmployees,
      generatedPayrolls,
      archivedRecords,
      incompleteRecords,
      pendingCorrections,
      timedInToday,
      latestPayrolls,
      balances,
    ] = await Promise.all([
      Attendance.countDocuments({ isArchived: false }),
      User.countDocuments({ role: "employee", isActive: true }),
      PayrollReport.countDocuments(),
      Attendance.countDocuments({ isArchived: true }),
      // Today's open records are normal during work hours, so only
      // earlier days count as needing attention
      Attendance.countDocuments({ ...INCOMPLETE_FILTER, date: { $lt: today } }),
      CorrectionRequest.countDocuments({ status: "pending" }),
      Attendance.countDocuments({ date: today }),
      PayrollReport.find()
        .populate("generatedBy", "firstName lastName role")
        .sort({ createdAt: -1 })
        .limit(5),
      getBalances(),
    ]);

    const outstandingCashAdvances = roundMoney(
      Object.values(balances).reduce((sum, item) => sum + Math.max(item.balance, 0), 0)
    );

    const latestPayroll = latestPayrolls[0];

    let recentPayrollActivity = {
      lastPayrollPeriod: "Not generated yet",
      processedEmployees: 0,
      lastGeneratedBy: "Not available",
      lastGeneratedDate: "Not available",
    };

    if (latestPayroll) {
      recentPayrollActivity = {
        lastPayrollPeriod: `${latestPayroll.payrollPeriodStart} to ${latestPayroll.payrollPeriodEnd}`,
        processedEmployees: latestPayroll.totalEmployees,
        lastGeneratedBy: `${latestPayroll.generatedBy?.firstName || ""} ${latestPayroll.generatedBy?.lastName || ""}`,
        lastGeneratedDate: latestPayroll.generatedDate,
      };
    }

    res.json({
      activeDTR,
      totalEmployees,
      generatedPayrolls,
      archivedRecords,
      incompleteRecords,
      pendingCorrections,
      timedInToday,
      outstandingCashAdvances,
      recentPayrollActivity,
      latestPayrolls: latestPayrolls.map((report) => ({
        _id: report._id,
        period: `${report.payrollPeriodStart} to ${report.payrollPeriodEnd}`,
        totalEmployees: report.totalEmployees,
        totalNet:
          report.totalNet ||
          roundMoney(report.employees.reduce((sum, emp) => sum + (emp.netSalary || 0), 0)),
        generatedBy: `${report.generatedBy?.firstName || ""} ${report.generatedBy?.lastName || ""}`.trim(),
        generatedDate: report.generatedDate || report.createdAt,
      })),
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch dashboard data",
      error: error.message,
    });
  }
};

exports.getEmployeeDashboard = async (req, res) => {
  try {
    const today = getToday();

    const [todayRecord, activeRecords, archivedRecords, pendingCorrections, latestReport, cashAdvance] =
      await Promise.all([
        Attendance.findOne({ employee: req.user._id, date: today }),
        Attendance.countDocuments({ employee: req.user._id, isArchived: false }),
        Attendance.countDocuments({ employee: req.user._id, isArchived: true }),
        CorrectionRequest.countDocuments({ employee: req.user._id, status: "pending" }),
        PayrollReport.findOne({ "employees.employee": req.user._id }).sort({
          payrollPeriodEnd: -1,
          createdAt: -1,
        }),
        getBalance(req.user._id),
      ]);

    let latestPayslip = null;

    if (latestReport) {
      const entry = latestReport.employees.find(
        (emp) => String(emp.employee) === String(req.user._id)
      );

      latestPayslip = {
        reportId: latestReport._id,
        period: `${latestReport.payrollPeriodStart} to ${latestReport.payrollPeriodEnd}`,
        netSalary: entry?.netSalary || 0,
      };
    }

    res.json({
      today,
      todayRecord,
      activeRecords,
      archivedRecords,
      pendingCorrections,
      cashAdvanceBalance: cashAdvance.balance,
      latestPayslip,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch dashboard data",
      error: error.message,
    });
  }
};
