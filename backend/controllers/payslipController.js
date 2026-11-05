const mongoose = require("mongoose");
const PayrollReport = require("../models/PayrollReport");
const Attendance = require("../models/Attendance");
const User = require("../models/User");

// Builds one employee's payslip from a generated payroll report.
// Uses the values stored at generation time so the payslip always matches
// the payroll report, plus the DTR records archived by that payroll.
const buildPayslip = async (reportId, employeeId) => {
  if (!mongoose.isValidObjectId(reportId) || !mongoose.isValidObjectId(employeeId)) {
    return null;
  }

  const report = await PayrollReport.findById(reportId).populate(
    "generatedBy",
    "firstName lastName"
  );

  if (!report) return null;

  const entry = report.employees.find(
    (emp) => String(emp.employee) === String(employeeId)
  );

  if (!entry) return null;

  const employee = await User.findById(employeeId).select(
    "employeeId firstName lastName email"
  );

  const records = await Attendance.find({
    payrollReport: report._id,
    employee: employeeId,
  })
    .select("date requiredTimeIn timeIn timeOut totalHours hourlyRate grossPay lateMinutes remarks")
    .sort({ date: 1 });

  return {
    reportId: report._id,
    payrollPeriodStart: report.payrollPeriodStart,
    payrollPeriodEnd: report.payrollPeriodEnd,
    generatedDate: report.generatedDate || report.createdAt,
    generatedBy: report.generatedBy
      ? `${report.generatedBy.firstName} ${report.generatedBy.lastName}`
      : "Administrator",
    employee: {
      _id: employeeId,
      employeeId: entry.employeeCode || employee?.employeeId || "-",
      name: entry.employeeName,
      email: employee?.email || "",
    },
    summary: {
      hourlyRate: entry.hourlyRate || 0,
      totalPresent: entry.totalPresent || 0,
      totalLate: entry.totalLate || 0,
      totalAbsent: entry.totalAbsent || 0,
      totalIncomplete: entry.totalIncomplete || 0,
      totalLateMinutes: entry.totalLateMinutes || 0,
      totalHours: entry.totalHours || 0,
      grossSalary: entry.grossSalary || 0,
      lateDeductions: entry.lateDeductions || 0,
      cashAdvance: entry.cashAdvance || 0,
      otherDeductions: entry.otherDeductions || 0,
      otherDeductionsNote: entry.otherDeductionsNote || "",
      netSalary: entry.netSalary || 0,
    },
    records,
  };
};

// ADMIN: payslip of any employee in a payroll report
exports.getPayslip = async (req, res) => {
  try {
    const payslip = await buildPayslip(req.params.reportId, req.params.employeeId);

    if (!payslip) {
      return res.status(404).json({
        message: "Payslip not found",
      });
    }

    res.json(payslip);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch payslip",
      error: error.message,
    });
  }
};

// EMPLOYEE: list of my payslips
exports.getMyPayslips = async (req, res) => {
  try {
    const reports = await PayrollReport.find({
      "employees.employee": req.user._id,
    }).sort({ payrollPeriodEnd: -1, createdAt: -1 });

    const payslips = reports.map((report) => {
      const entry = report.employees.find(
        (emp) => String(emp.employee) === String(req.user._id)
      );

      return {
        reportId: report._id,
        payrollPeriodStart: report.payrollPeriodStart,
        payrollPeriodEnd: report.payrollPeriodEnd,
        generatedDate: report.generatedDate || report.createdAt,
        totalHours: entry?.totalHours || 0,
        grossSalary: entry?.grossSalary || 0,
        totalDeductions:
          (entry?.lateDeductions || 0) +
          (entry?.cashAdvance || 0) +
          (entry?.otherDeductions || 0),
        netSalary: entry?.netSalary || 0,
      };
    });

    res.json(payslips);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch payslips",
      error: error.message,
    });
  }
};

// EMPLOYEE: one of my payslips (employees can only open their own)
exports.getMyPayslip = async (req, res) => {
  try {
    const payslip = await buildPayslip(req.params.reportId, req.user._id);

    if (!payslip) {
      return res.status(404).json({
        message: "Payslip not found",
      });
    }

    res.json(payslip);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch payslip",
      error: error.message,
    });
  }
};
