// Shared display helpers used across admin and employee pages

export const formatMoney = (value) => {
  return `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

export const formatDate = (date) => {
  if (!date) return "-";
  return typeof date === "string" && date.includes("T") ? date.slice(0, 10) : date;
};

export const formatLongDate = (date) => {
  if (!date) return "-";

  return new Date(date).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

export const formatDateTime = (date) => {
  if (!date) return "-";

  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export const formatMinutes = (minutes) => {
  const value = Number(minutes || 0);
  if (value <= 0) return "0 min";

  const hours = Math.floor(value / 60);
  const mins = value % 60;

  if (hours === 0) return `${mins} min`;
  return mins === 0 ? `${hours} hr` : `${hours} hr ${mins} min`;
};

export const getEmployeeName = (employee) => {
  if (!employee) return "Deleted employee";
  return `${employee.firstName || ""} ${employee.lastName || ""}`.trim();
};

// A DTR is incomplete when the employee timed in but has no time-out
// (Absent records are final and need no time-out)
export const isIncompleteRecord = (record) => {
  return Boolean(record?.timeIn && !record?.timeOut && record?.remarks !== "Absent");
};

// Status label shown in DTR tables
export const getRecordStatus = (record) => {
  if (!record) return "Incomplete";
  if (isIncompleteRecord(record)) return "Incomplete";
  return record.remarks || "Incomplete";
};
