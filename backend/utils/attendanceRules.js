// ATTENDANCE RULES
// - Present: time-in is on or before the required time-in
// - Late:    time-in is after the required time-in but less than 90 minutes late
// - Absent:  time-in is 90 minutes late or more (0 hours, ₱0 gross pay)
//
// Paid hours are counted from the ACTUAL time-in to the time-out.
// Lateness already reduces the paid hours, so no separate late deduction is
// charged (lateDeduction is always 0). Late minutes are still recorded.

const ABSENT_THRESHOLD_MINUTES = 90;

// Ladupan runs 24 hours (e.g. 06:00–18:00 and 18:00–06:00 shifts).
// A DTR record belongs to the date the shift STARTED. A time-out earlier
// than the time-in means the next day. No shift may exceed this length.
const MAX_SHIFT_HOURS = 16;
const MAX_SHIFT_MINUTES = MAX_SHIFT_HOURS * 60;

const timeToMinutes = (time) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

const roundMoney = (value) => Number(Number(value || 0).toFixed(2));

// Time-out on or before the time-in = it happened the next day
const crossesMidnight = (timeIn, timeOut) =>
  Boolean(timeIn && timeOut) && timeToMinutes(timeOut) <= timeToMinutes(timeIn);

// Minutes from time-in to time-out, counting across midnight
const shiftMinutes = (timeIn, timeOut) => {
  let minutes = timeToMinutes(timeOut) - timeToMinutes(timeIn);
  if (minutes <= 0) minutes += 24 * 60;
  return minutes;
};

// Validation for any time-in / time-out pair (admin edits, corrections)
const validateShiftTimes = (timeIn, timeOut) => {
  if (!timeOut) return null;

  if (timeToMinutes(timeOut) === timeToMinutes(timeIn)) {
    return "Time out can't be the same as time in";
  }

  if (shiftMinutes(timeIn, timeOut) > MAX_SHIFT_MINUTES) {
    return `A shift can't be longer than ${MAX_SHIFT_HOURS} hours. A time out earlier than the time in counts as the next day, so check both times.`;
  }

  return null;
};

// Remarks and late minutes based on time-in only
// (used at time-in, before the employee has timed out).
const calculateTimeIn = ({ requiredTimeIn, timeIn }) => {
  // Difference on a 24-hour clock, kept within ±12 hours, so a 00:10
  // time-in for a 23:30 schedule is 40 minutes late (not 23 hours early)
  let difference = timeToMinutes(timeIn) - timeToMinutes(requiredTimeIn);
  if (difference > 12 * 60) difference -= 24 * 60;
  if (difference <= -12 * 60) difference += 24 * 60;

  const lateMinutes = Math.max(difference, 0);

  let remarks = "Present";

  if (lateMinutes >= ABSENT_THRESHOLD_MINUTES) {
    remarks = "Absent";
  } else if (lateMinutes > 0) {
    remarks = "Late";
  }

  return { lateMinutes, remarks };
};

const calculateAttendance = ({
  requiredTimeIn,
  timeIn,
  timeOut,
  hourlyRate,
}) => {
  const { lateMinutes, remarks } = calculateTimeIn({ requiredTimeIn, timeIn });

  if (remarks === "Absent") {
    return {
      totalHours: 0,
      lateMinutes,
      lateHours: 0,
      grossPay: 0,
      lateDeduction: 0,
      remarks,
    };
  }

  // Counts across midnight (18:00 -> 06:00 = 12 hours)
  const workedMinutes = shiftMinutes(timeIn, timeOut);
  const totalHours = Number((workedMinutes / 60).toFixed(2));
  const lateHours = Number((lateMinutes / 60).toFixed(2));
  const grossPay = roundMoney(totalHours * hourlyRate);

  return {
    totalHours,
    lateMinutes,
    lateHours,
    grossPay,
    lateDeduction: 0,
    remarks,
  };
};

// Recompute every derived field of an Attendance document in place.
// A record without a time-out has 0 hours until it is completed
// (except Absent, which is 0 hours regardless).
const applyAttendanceRules = (attendance) => {
  if (!attendance.timeIn) {
    attendance.totalHours = 0;
    attendance.grossPay = 0;
    attendance.lateMinutes = 0;
    attendance.lateDeduction = 0;
    attendance.remarks = "Present";
    return attendance;
  }

  attendance.timeOutNextDay = crossesMidnight(attendance.timeIn, attendance.timeOut);

  if (attendance.timeOut) {
    const result = calculateAttendance({
      requiredTimeIn: attendance.requiredTimeIn,
      timeIn: attendance.timeIn,
      timeOut: attendance.timeOut,
      hourlyRate: attendance.hourlyRate,
    });

    attendance.totalHours = result.totalHours;
    attendance.grossPay = result.grossPay;
    attendance.lateMinutes = result.lateMinutes;
    attendance.lateDeduction = result.lateDeduction;
    attendance.remarks = result.remarks;
    return attendance;
  }

  const { lateMinutes, remarks } = calculateTimeIn({
    requiredTimeIn: attendance.requiredTimeIn,
    timeIn: attendance.timeIn,
  });

  attendance.totalHours = 0;
  attendance.grossPay = 0;
  attendance.lateMinutes = lateMinutes;
  attendance.lateDeduction = 0;
  attendance.remarks = remarks;
  return attendance;
};

// A record is incomplete when the employee timed in but never timed out.
// Absent records are already final (0 hours) and do not need a time-out.
const isIncomplete = (attendance) => {
  return Boolean(
    attendance.timeIn && !attendance.timeOut && attendance.remarks !== "Absent"
  );
};

module.exports = {
  ABSENT_THRESHOLD_MINUTES,
  MAX_SHIFT_HOURS,
  MAX_SHIFT_MINUTES,
  crossesMidnight,
  shiftMinutes,
  validateShiftTimes,
  timeToMinutes,
  roundMoney,
  calculateTimeIn,
  calculateAttendance,
  applyAttendanceRules,
  isIncomplete,
};
