const Setting = require("../models/Setting");
const Attendance = require("../models/Attendance");
const { applyAttendanceRules } = require("./attendanceRules");
const { getToday } = require("./timeUtils");

// One-time data updates, run when the server starts. Each runs once; its
// name is saved in the settings so it is skipped afterwards.
const TASKS = [
  {
    // Overtime starts at required time-in + 14 hours for everyone (was the
    // employee's shift hours). Recalculate DTRs that aren't in a payroll yet.
    // Approved overtime stays approved; anything else past 14 hours goes
    // back to the review list.
    name: "overtime-14h",
    run: async () => {
      const records = await Attendance.find({ isArchived: false, timeIn: { $ne: null } });
      let changed = 0;

      for (const record of records) {
        if (!record.overtimeApproved) record.overtimeReviewed = false;
        applyAttendanceRules(record);
        if (record.isModified()) {
          await record.save();
          changed += 1;
        }
      }

      return `${changed} of ${records.length} active DTRs recalculated`;
    },
  },
  {
    // No-show absences are counted from today, not for days before the
    // rest-day schedule existed
    name: "absence-tracking-start",
    run: async (settings) => {
      if (!settings.absenceTrackingFrom) settings.absenceTrackingFrom = getToday();
      return `absences counted from ${settings.absenceTrackingFrom}`;
    },
  },
];

const runStartupTasks = async () => {
  const settings = await Setting.getSettings();
  const done = new Set(settings.completedTasks || []);

  for (const task of TASKS) {
    if (done.has(task.name)) continue;

    try {
      const result = await task.run(settings);
      settings.completedTasks = [...(settings.completedTasks || []), task.name];
      await settings.save();
      console.log(`Startup task "${task.name}": ${result}`);
    } catch (error) {
      console.error(`Startup task "${task.name}" failed:`, error.message);
    }
  }
};

module.exports = { runStartupTasks };
