import { useEffect, useState } from "react";
import api from "../api/axios";
import Spinner from "./Spinner";
import TimeOutValue from "./TimeOutValue";
import { useToast } from "../context/ToastContext";
import { getEmployeeName } from "../utils/format";

export const formatMinutes = (minutes = 0) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h${m ? ` ${String(m).padStart(2, "0")}m` : ""}` : `${m}m`;
};

// Admin: shifts that ended past required time-in + 14 hours (stayed very late,
// or came back later to time out). The extra time is paid only when approved.
const OvertimeCard = () => {
  const [records, setRecords] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState("");
  const toast = useToast();

  const fetchRecords = async () => {
    try {
      const res = await api.get("/attendance/overtime");
      setRecords(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching overtime:", err);
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const review = async (record, approved) => {
    try {
      setBusy(`${record._id}-${approved}`);
      const res = await api.put(`/attendance/${record._id}/overtime`, { approved });
      toast.success(res.data.message);
      fetchRecords();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save.");
    } finally {
      setBusy("");
    }
  };

  if (!loaded || records.length === 0) return null;

  return (
    <div className="lp-card">
      <h2>
        Overtime to review <span className="lp-count">{records.length}</span>
      </h2>
      <p className="lp-card-subtitle">
        These employees timed out more than 14 hours after their required time in. They stayed very
        late, or came back later to time out. Time up to the 14-hour limit is counted; the overtime is
        paid only if you approve it.
      </p>

      <div className="lp-table-wrap">
        <table className="lp-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Date</th>
              <th>Time In</th>
              <th>Overtime after</th>
              <th>Time Out</th>
              <th>Overtime</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record._id}>
                <td>
                  <strong>{getEmployeeName(record.employee)}</strong>
                  <div className="lp-muted">{record.employee?.employeeId}</div>
                </td>
                <td className="lp-nowrap">{record.date}</td>
                <td className="lp-nowrap">{record.timeIn}</td>
                <td className="lp-nowrap">
                  {record.overtimeStarts}
                  <div className="lp-muted">Required {record.requiredTimeIn} + 14 hrs</div>
                </td>
                <td className="lp-nowrap">
                  <TimeOutValue record={record} />
                </td>
                <td className="lp-nowrap">
                  <strong>{formatMinutes(record.overtimeMinutes)}</strong>
                  <div className="lp-muted">{record.totalHours} hrs paid now</div>
                </td>
                <td>
                  <div className="lp-btn-row">
                    <button
                      className="lp-btn success small"
                      onClick={() => review(record, true)}
                      disabled={Boolean(busy)}
                      aria-busy={busy === `${record._id}-true`}
                    >
                      {busy === `${record._id}-true` && <Spinner />}
                      Pay Overtime
                    </button>
                    <button
                      className="lp-btn secondary small"
                      onClick={() => review(record, false)}
                      disabled={Boolean(busy)}
                      aria-busy={busy === `${record._id}-false`}
                    >
                      {busy === `${record._id}-false` && <Spinner />}
                      Don't Pay
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OvertimeCard;
