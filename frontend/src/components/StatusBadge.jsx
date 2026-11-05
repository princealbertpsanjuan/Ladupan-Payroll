import { isIncompleteRecord } from "../utils/format";

// Shows the DTR remark (Present / Late / Absent) and, when the employee
// timed in but has no time-out yet, an extra "No time-out" badge.
const StatusBadge = ({ record }) => {
  const remarks = record?.remarks || "Present";

  return (
    <span className="status-group">
      <span className={`status ${remarks.toLowerCase()}`}>{remarks}</span>

      {isIncompleteRecord(record) && (
        <span className="status incomplete">No time-out</span>
      )}
    </span>
  );
};

export default StatusBadge;
