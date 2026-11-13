const PayrollReport = require("../models/PayrollReport");
const Attendance = require("../models/Attendance");
const User = require("../models/User");

// GET ALL PAYROLL REPORTS
exports.getPayrollReports = async (req, res) => {
  try {
    const reports = await PayrollReport.find()
      .populate("generatedBy", "firstName lastName email")
      .sort({ createdAt: -1 });

    res.json(reports);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch payroll reports",
      error: error.message,
    });
  }
};

// GET SINGLE PAYROLL REPORT
exports.getPayrollReportById = async (req, res) => {
  try {
    const report = await PayrollReport.findById(req.params.id)
      .populate("generatedBy", "firstName lastName email")
      .populate("employees.employee", "employeeId firstName lastName email");

    if (!report) {
      return res.status(404).json({
        message: "Payroll report not found",
      });
    }

    res.json(report);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch payroll report",
      error: error.message,
    });
  }
};

// GET ARCHIVED ATTENDANCE RECORDS
exports.getArchivedAttendance = async (req, res) => {
  try {
    const records = await Attendance.find({
      isArchived: true,
    })
      .populate(
        "payrollReport",
        "payrollPeriodStart payrollPeriodEnd employees.employee employees.employeeName employees.employeeCode"
      )
      .sort({ date: -1 })
      .lean();

    // Attach each record's employee. If the employee was deleted, use the
    // name and ID saved in the payroll report, so archives stay readable
    // and can still be grouped by employee.
    const employeeIds = [...new Set(records.map((record) => String(record.employee)))];

    const users = await User.find({ _id: { $in: employeeIds } })
      .select("employeeId firstName lastName email")
      .lean();

    const userMap = new Map(users.map((user) => [String(user._id), user]));

    const result = records.map((record) => {
      const id = String(record.employee);
      let employee = userMap.get(id);

      if (!employee) {
        const snapshot = record.payrollReport?.employees?.find(
          (entry) => String(entry.employee) === id
        );

        employee = {
          _id: id,
          employeeId: snapshot?.employeeCode || "",
          firstName: snapshot?.employeeName || "Deleted employee",
          lastName: "",
          isDeleted: true,
        };
      }

      const payrollReport = record.payrollReport
        ? {
            _id: record.payrollReport._id,
            payrollPeriodStart: record.payrollReport.payrollPeriodStart,
            payrollPeriodEnd: record.payrollReport.payrollPeriodEnd,
          }
        : null;

      return { ...record, employee, payrollReport };
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch archived attendance",
      error: error.message,
    });
  }
};