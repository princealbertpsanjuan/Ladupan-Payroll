const User = require("../models/User");
const RestDay = require("../models/RestDay");
const Notification = require("../models/Notification");
const { logAudit, fullName } = require("../utils/auditLogger");
const { notifyUser } = require("../utils/notify");
const { isValidDate, getToday } = require("../utils/timeUtils");
const {
  datesInMonth,
  buildDayStatus,
  loadPayrollPeriods,
  inPeriods,
} = require("../utils/absenceUtils");

const isValidMonth = (month) => typeof month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(month);

const monthLabel = (month) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

const shortDate = (date) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

const monthRange = (month) => {
  const dates = datesInMonth(month);
  return { startDate: dates[0], endDate: dates[dates.length - 1], dates };
};

// One notification per employee per month while the admin is editing:
// later changes within 30 minutes update the same (unread) notification.
const notifyScheduleChange = async (employeeId, month, changeText) => {
  const since = new Date(Date.now() - 30 * 60 * 1000);
  const existing = await Notification.findOne({
    recipient: employeeId,
    type: "schedule_changed",
    isRead: false,
    createdAt: { $gte: since },
    "meta.month": month,
  });

  if (existing) {
    const changes = [...(existing.meta?.changes || []), changeText].slice(-8);
    existing.meta = { month, changes };
    existing.message = `${changes.join("; ")}.`;
    existing.markModified("meta");
    await existing.save();
    return;
  }

  await notifyUser(employeeId, {
    type: "schedule_changed",
    level: "info",
    title: `Your rest days for ${monthLabel(month)} were updated`,
    message: `${changeText}.`,
    link: "/client/schedule",
    meta: { month, changes: [changeText] },
  });
};

// ADMIN: month grid (active employees, rest days, worked / absent days)
exports.getMonthSchedule = async (req, res) => {
  try {
    const month = req.query.month || getToday().slice(0, 7);

    if (!isValidMonth(month)) {
      return res.status(400).json({ message: "Month must be YYYY-MM" });
    }

    const { startDate, endDate, dates } = monthRange(month);
    const employees = await User.find({ role: "employee", isActive: true })
      .select("employeeId firstName lastName requiredTimeIn createdAt")
      .sort({ employeeId: 1 });

    const days = await buildDayStatus({ employees, startDate, endDate });

    res.json({
      month,
      dates,
      today: getToday(),
      employees: employees.map((employee) => ({
        _id: employee._id,
        employeeId: employee.employeeId,
        firstName: employee.firstName,
        lastName: employee.lastName,
        requiredTimeIn: employee.requiredTimeIn,
        days: days[String(employee._id)],
      })),
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to load the schedule", error: error.message });
  }
};

const loadEmployee = async (employeeId) => {
  const employee = await User.findById(employeeId).select("firstName lastName role isActive");
  return employee && employee.role === "employee" ? employee : null;
};

// ADMIN: set or remove one rest day
exports.setRestDay = async (req, res) => {
  try {
    const { employeeId, date, rest } = req.body;

    if (!isValidDate(date) || typeof rest !== "boolean") {
      return res.status(400).json({ message: "A valid date and rest (true/false) are required" });
    }

    const employee = await loadEmployee(employeeId);
    if (!employee) return res.status(404).json({ message: "Employee not found" });

    const periods = await loadPayrollPeriods([employee._id], date, date);
    if (inPeriods(periods[String(employee._id)], date)) {
      return res.status(400).json({
        message: `${shortDate(date)} is already in a generated payroll for ${fullName(employee)}, so it can't be changed.`,
      });
    }

    if (rest) {
      const result = await RestDay.updateOne(
        { employee: employee._id, date },
        { $setOnInsert: { employee: employee._id, date, createdBy: req.user._id } },
        { upsert: true }
      );
      if (!result.upsertedCount) return res.json({ message: "Already a rest day" });
    } else {
      const result = await RestDay.deleteOne({ employee: employee._id, date });
      if (!result.deletedCount) return res.json({ message: "Already a work day" });
    }

    const text = rest ? `${shortDate(date)} is a rest day` : `${shortDate(date)} is now a work day`;

    await logAudit(req, {
      action: rest ? "REST_DAY_SET" : "REST_DAY_REMOVED",
      entityType: "Employee",
      entityId: employee._id,
      description: `${fullName(employee)}: ${text}`,
      details: { date },
    });

    await notifyScheduleChange(employee._id, date.slice(0, 7), text);

    res.json({ message: `${fullName(employee)}: ${text}` });
  } catch (error) {
    res.status(500).json({ message: "Failed to update the rest day", error: error.message });
  }
};

// ADMIN: mark (or clear) every given weekday of a month, e.g. every Sunday
exports.fillWeekday = async (req, res) => {
  try {
    const { employeeId, month, weekday, rest } = req.body;
    const day = Number(weekday);

    if (!isValidMonth(month) || !Number.isInteger(day) || day < 0 || day > 6 || typeof rest !== "boolean") {
      return res.status(400).json({ message: "Employee, month, weekday (0-6) and rest are required" });
    }

    const employee = await loadEmployee(employeeId);
    if (!employee) return res.status(404).json({ message: "Employee not found" });

    const { startDate, endDate, dates } = monthRange(month);
    const periods = await loadPayrollPeriods([employee._id], startDate, endDate);
    const targets = dates.filter(
      (date) =>
        new Date(`${date}T00:00:00Z`).getUTCDay() === day && !inPeriods(periods[String(employee._id)], date)
    );

    if (targets.length === 0) {
      return res.status(400).json({ message: "No days to change (they may already be in a payroll)" });
    }

    if (rest) {
      await RestDay.bulkWrite(
        targets.map((date) => ({
          updateOne: {
            filter: { employee: employee._id, date },
            update: { $setOnInsert: { employee: employee._id, date, createdBy: req.user._id } },
            upsert: true,
          },
        }))
      );
    } else {
      await RestDay.deleteMany({ employee: employee._id, date: { $in: targets } });
    }

    const weekdayName = new Date(`${targets[0]}T00:00:00Z`).toLocaleDateString("en-US", {
      weekday: "long",
      timeZone: "UTC",
    });
    const text = rest
      ? `every ${weekdayName} in ${monthLabel(month)} is a rest day`
      : `${weekdayName}s in ${monthLabel(month)} are work days`;

    await logAudit(req, {
      action: rest ? "REST_DAY_SET" : "REST_DAY_REMOVED",
      entityType: "Employee",
      entityId: employee._id,
      description: `${fullName(employee)}: ${text} (${targets.length} days)`,
      details: { dates: targets },
    });

    await notifyScheduleChange(employee._id, month, text.charAt(0).toUpperCase() + text.slice(1));

    res.json({ message: `${fullName(employee)}: ${text}`, count: targets.length });
  } catch (error) {
    res.status(500).json({ message: "Failed to update rest days", error: error.message });
  }
};

// EMPLOYEE: own month (rest days, worked days, absences)
exports.getMySchedule = async (req, res) => {
  try {
    const month = req.query.month || getToday().slice(0, 7);

    if (!isValidMonth(month)) {
      return res.status(400).json({ message: "Month must be YYYY-MM" });
    }

    const { startDate, endDate, dates } = monthRange(month);
    const days = await buildDayStatus({ employees: [req.user], startDate, endDate });

    res.json({
      month,
      dates,
      today: getToday(),
      requiredTimeIn: req.user.requiredTimeIn,
      days: days[String(req.user._id)],
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to load your schedule", error: error.message });
  }
};
