// All attendance dates and times follow Ladupan's local time (Philippines),
// regardless of the timezone of the server the API is hosted on.
const TIMEZONE = process.env.APP_TIMEZONE || "Asia/Manila";

const getParts = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const result = {};
  parts.forEach((part) => {
    result[part.type] = part.value;
  });

  return result;
};

// YYYY-MM-DD in local time
const getToday = (date = new Date()) => {
  const { year, month, day } = getParts(date);
  return `${year}-${month}-${day}`;
};

// HH:mm (24-hour) in local time
const getCurrentTime = (date = new Date()) => {
  const { hour, minute } = getParts(date);
  return `${hour}:${minute}`;
};

const isValidDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
};

const isValidTime = (value) => {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
};

// "2026-11-13" + n days -> "2026-11-14"
const addDays = (date, days) => {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

const getYesterday = () => addDays(getToday(), -1);

module.exports = {
  TIMEZONE,
  getToday,
  getYesterday,
  addDays,
  getCurrentTime,
  isValidDate,
  isValidTime,
};
