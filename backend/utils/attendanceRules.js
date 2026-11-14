// ATTENDANCE RULES
// - Present: time-in is on or before the required time-in
// - Late:    time-in is after the required time-in but less than 90 minutes late
// - Absent:  time-in is 90 minutes late or more (0 hours, ₱0 gross pay)
//
// Paid hours are counted from the ACTUAL time-in to the time-out, but stop
// at the scheduled end (required time-in + shift hours). Time after that is
// overtime: recorded, and paid only when the admin approves it.
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

// Time-out earlier than the time-in = it happened the next day.
// The same minute means a time-out right after the time-in (0 minutes),
// never a 24-hour shift (shifts can't exceed MAX_SHIFT_HOURS anyway).
const crossesMidnight = (timeIn, timeOut) =>
  Boolean(timeIn && timeOut) && timeToMinutes(timeOut) < timeToMinutes(timeIn);

// Minutes from time-in to time-out, counting across midnight
const shiftMinutes = (timeIn, timeOut) => {
  let minutes = timeToMinutes(timeOut) - timeToMinutes(timeIn);
  if (minutes < 0) minutes += 24 * 60;
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

// Signed minutes from the required time-in to the actual time-in, on a
// 24-hour clock kept within ±12 hours (negative = early). A 00:10 time-in
// for a 23:30 schedule is +40 (not 23 hours early).
const timeInOffset = (requiredTimeIn, timeIn) => {
  let difference = timeToMinutes(timeIn) - timeToMinutes(requiredTimeIn);
  if (difference > 12 * 60) difference -= 24 * 60;
  if (difference <= -12 * 60) difference += 24 * 60;
  return difference;
};

// Scheduled end as HH:mm (e.g. 18:00 + 12h -> 06:00)
const scheduledEndTime = (requiredTimeIn, scheduledHours) => {
  if (!requiredTimeIn || !scheduledHours) return null;
  const total = (timeToMinutes(requiredTimeIn) + Math.round(scheduledHours * 60)) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

// Remarks and late minutes based on time-in only
// (used at time-in, before the employee has timed out).
const calculateTimeIn = ({ requiredTimeIn, timeIn }) => {
  const difference = timeInOffset(requiredTimeIn, timeIn);

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
  scheduledHours = null,
  overtimeApproved = false,
}) => {
  const { lateMinutes, remarks } = calculateTimeIn({ requiredTimeIn, timeIn });

  if (remarks === "Absent") {
    return {
      totalHours: 0,
      lateMinutes,
      lateHours: 0,
      grossPay: 0,
      lateDeduction: 0,
      overtimeMinutes: 0,
      remarks,
    };
  }

  // Counts across midnight (18:00 -> 06:00 = 12 hours)
  const workedMinutes = shiftMinutes(timeIn, timeOut);

  // Minutes from the actual time-in to the scheduled end
  let overtimeMinutes = 0;
  let paidMinutes = workedMinutes;

  if (scheduledHours) {
    const untilScheduledEnd = Math.max(
      0,
      Math.round(scheduledHours * 60) - timeInOffset(requiredTimeIn, timeIn)
    );
    overtimeMinutes = Math.max(0, workedMinutes - untilScheduledEnd);
    if (!overtimeApproved) paidMinutes = workedMinutes - overtimeMinutes;
  }

  const totalHours = Number((paidMinutes / 60).toFixed(2));
  const lateHours = Number((lateMinutes / 60).toFixed(2));
  const grossPay = roundMoney(totalHours * hourlyRate);

  return {
    totalHours,
    lateMinutes,
    lateHours,
    grossPay,
    lateDeduction: 0,
    overtimeMinutes,
    remarks,
  };
};

// Recompute every derived field of an Attendance document in place.
// A record without a time-out has 0 hours until it is completed
// (except Absent, which is 0 hours regardless).
const applyAttendanceRules = (attendance) => {
  if (!attendance.timeIn) {
    attendance.overtimeMinutes = 0;
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
      scheduledHours: attendance.scheduledHours,
      overtimeApproved: attendance.overtimeApproved,
    });

    attendance.overtimeMinutes = result.overtimeMinutes;
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

  attendance.overtimeMinutes = 0;
  attendance.totalHours = 0;
  attendance.grossPay = 0;
  attendance.lateMinutes = lateMinutes;
  attendance.lateDeduction = 0;
  attendance.remarks = remarks;
  return attendance;
};

// A record is incomplete when the employee timed in but never timed out.
// Absent records are already final (0 hours) and do not need a time-out.
// Overtime worth the admin's attention (30+ minutes, not reviewed yet)
const OVERTIME_REVIEW_MINUTES = 30;
const needsOvertimeReview = (attendance) =>
  Boolean(
    attendance.scheduledHours &&
      attendance.timeOut &&
      attendance.overtimeMinutes >= OVERTIME_REVIEW_MINUTES &&
      !attendance.overtimeReviewed
  );

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
  timeInOffset,
  scheduledEndTime,
  roundMoney,
  calculateTimeIn,
  calculateAttendance,
  applyAttendanceRules,
  isIncomplete,
  OVERTIME_REVIEW_MINUTES,
  needsOvertimeReview,
};
