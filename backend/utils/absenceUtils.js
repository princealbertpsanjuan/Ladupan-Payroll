const Attendance = require("../models/Attendance");
const RestDay = require("../models/RestDay");
const PayrollReport = require("../models/PayrollReport");
const Setting = require("../models/Setting");
const { getToday, getCurrentTime, addDays } = require("./timeUtils");
const { timeToMinutes } = require("./attendanceRules");

// Same as the lateness rule: 90+ minutes late = Absent. A scheduled work day
// with no time-in by required time-in + 90 minutes is "Absent (no time in)".
const NO_SHOW_AFTER_MINUTES = 90;

const dayNumber = (date) => Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400000);

// "2026-11" -> ["2026-11-01", ..., "2026-11-30"]
const datesInMonth = (month) => {
  const [year, mon] = month.split("-").map(Number);
  const days = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  return Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
};

const datesBetween = (startDate, endDate) => {
  const dates = [];
  for (let d = startDate; d <= endDate; d = addDays(d, 1)) dates.push(d);
  return dates;
};

// Philippine date an account was created (no absences before that)
const createdDate = (employee) => (employee.createdAt ? getToday(new Date(employee.createdAt)) : null);

// Has the no-show deadline (date + required time-in + 90 min) passed?
const deadlinePassed = (date, requiredTimeIn, today, nowTime) => {
  const deadline = dayNumber(date) * 1440 + timeToMinutes(requiredTimeIn || "00:00") + NO_SHOW_AFTER_MINUTES;
  const now = dayNumber(today) * 1440 + timeToMinutes(nowTime);
  return now >= deadline;
};

// Days already covered by a generated payroll, per employee:
// { employeeId: [[start, end], ...] }
const loadPayrollPeriods = async (employeeIds, startDate, endDate) => {
  const reports = await PayrollReport.find({
    payrollPeriodStart: { $lte: endDate },
    payrollPeriodEnd: { $gte: startDate },
    "employees.employee": { $in: employeeIds },
  }).select("payrollPeriodStart payrollPeriodEnd employees.employee");

  const periods = {};
  reports.forEach((report) => {
    report.employees.forEach((row) => {
      const key = String(row.employee);
      if (!employeeIds.some((id) => String(id) === key)) return;
      (periods[key] = periods[key] || []).push([report.payrollPeriodStart, report.payrollPeriodEnd]);
    });
  });
  return periods;
};

const inPeriods = (periods = [], date) => periods.some(([start, end]) => date >= start && date <= end);

// For each employee and date in the range: "worked" (has a DTR), "rest",
// "absent" (no-show), "upcoming" (deadline not passed yet) or "none"
// (before absences were tracked / before the account existed).
// Also returns which dates are locked by a generated payroll.
const buildDayStatus = async ({ employees, startDate, endDate }) => {
  const settings = await Setting.getSettings();
  const trackingFrom = settings.absenceTrackingFrom || getToday();
  const today = getToday();
  const nowTime = getCurrentTime();
  const ids = employees.map((employee) => employee._id);

  const [records, restDays, periods] = await Promise.all([
    Attendance.find({ employee: { $in: ids }, date: { $gte: startDate, $lte: endDate } }).select(
      "employee date timeIn remarks isArchived"
    ),
    RestDay.find({ employee: { $in: ids }, date: { $gte: startDate, $lte: endDate } }).select("employee date"),
    loadPayrollPeriods(ids, startDate, endDate),
  ]);

  const recordMap = new Map(records.map((r) => [`${r.employee}|${r.date}`, r]));
  const restSet = new Set(restDays.map((r) => `${r.employee}|${r.date}`));
  const dates = datesBetween(startDate, endDate);
  const result = {};

  employees.forEach((employee) => {
    const key = String(employee._id);
    const firstDay = [trackingFrom, createdDate(employee)].filter(Boolean).sort().pop();
    const days = {};

    dates.forEach((date) => {
      const record = recordMap.get(`${key}|${date}`);
      const rest = restSet.has(`${key}|${date}`);
      const locked = inPeriods(periods[key], date);
      let status;

      if (record) status = "worked";
      else if (rest) status = "rest";
      else if (date < firstDay || locked) status = "none";
      else if (date > today || !deadlinePassed(date, employee.requiredTimeIn, today, nowTime)) status = "upcoming";
      else status = "absent";

      days[date] = { status, rest, locked, remarks: record?.remarks || null };
    });

    result[key] = days;
  });

  return result;
};

// { employeeId: ["2026-11-03", ...] } no-show dates in the range
const getNoShows = async ({ employees, startDate, endDate }) => {
  const status = await buildDayStatus({ employees, startDate, endDate });
  const result = {};

  Object.entries(status).forEach(([key, days]) => {
    result[key] = Object.entries(days)
      .filter(([, day]) => day.status === "absent")
      .map(([date]) => date);
  });

  return result;
};

module.exports = {
  NO_SHOW_AFTER_MINUTES,
  datesInMonth,
  datesBetween,
  buildDayStatus,
  getNoShows,
  loadPayrollPeriods,
  inPeriods,
};
