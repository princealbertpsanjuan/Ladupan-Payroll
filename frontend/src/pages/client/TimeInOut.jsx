import { useEffect, useState } from "react";
import api from "../../api/axios";
import { useToast } from "../../context/ToastContext";
import StatusBadge from "../../components/StatusBadge";
import Spinner from "../../components/Spinner";
import { formatMoney, formatMinutes } from "../../utils/format";
import "../../styles/timeinout.css";

const TimeInOut = () => {
  const toast = useToast();

  // Results and errors are shown as toasts
  const setMessage = ({ type, text }) => {
    if (text) toast[type](text);
  };
  const [attendance, setAttendance] = useState(null);
  const [serverDate, setServerDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [checking, setChecking] = useState(true);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    fetchTodayAttendance();

    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // "Today" is decided by the server in Philippine time,
  // so the record always matches the correct date
  const fetchTodayAttendance = async () => {
    try {
      setChecking(true);
      const res = await api.get("/attendance/today");
      setAttendance(res.data.attendance);
      setServerDate(res.data.date);
    } catch (error) {
      console.error("Error fetching attendance:", error);
    } finally {
      setChecking(false);
    }
  };

  const handleTimeIn = async () => {
    try {
      setLoading(true);
      setBusyAction("in");

      const res = await api.post("/attendance/time-in");

      setMessage({
        type: res.data.attendance?.remarks === "Absent" ? "warning" : "success",
        text: res.data.message,
      });
      setAttendance(res.data.attendance);
    } catch (err) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Time in failed",
      });
    } finally {
      setLoading(false);
      setBusyAction("");
    }
  };

  const handleTimeOut = async () => {
    try {
      setLoading(true);
      setBusyAction("out");

      const res = await api.put("/attendance/time-out");

      setMessage({ type: "success", text: res.data.message });
      setAttendance(res.data.attendance);
    } catch (err) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Time out failed",
      });
    } finally {
      setLoading(false);
      setBusyAction("");
    }
  };

  const hasTimedIn = Boolean(attendance?.timeIn);
  const hasTimedOut = Boolean(attendance?.timeOut);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Manila",
  });

  const clock = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Manila",
  });

  return (
    <div className="client-dashboard-page">
      <div className="client-welcome-card">
        <div>
          <h1>Time In / Time Out</h1>
          <p>Manage your daily attendance records.</p>
        </div>

        <span>
          {today} · {clock}
        </span>
      </div>

      <div className="time-card">
        <div className="time-actions">
          <button
            className="time-in-btn"
            onClick={handleTimeIn}
            disabled={loading || checking || hasTimedIn}
            aria-busy={busyAction === "in"}
          >
            {busyAction === "in" && <Spinner />}
            {busyAction === "in" ? "Recording..." : hasTimedIn ? "Timed In ✓" : "Time In"}
          </button>

          <button
            className="time-out-btn"
            onClick={handleTimeOut}
            disabled={loading || checking || !hasTimedIn || hasTimedOut}
            aria-busy={busyAction === "out"}
          >
            {busyAction === "out" && <Spinner />}
            {busyAction === "out" ? "Recording..." : hasTimedOut ? "Timed Out ✓" : "Time Out"}
          </button>
        </div>

        {!checking && hasTimedIn && hasTimedOut && (
          <div className="attendance-message lp-alert info">
            Your attendance for today is complete. If something is wrong,
            send a DTR correction request from My Records.
          </div>
        )}

        <div className="attendance-info-grid">
          <div className="attendance-info-card">
            <span>Date</span>
            <strong>{attendance?.date || serverDate || "No record"}</strong>
          </div>

          <div className="attendance-info-card">
            <span>Time In</span>
            <strong>{attendance?.timeIn || "Not yet"}</strong>
          </div>

          <div className="attendance-info-card">
            <span>Time Out</span>
            <strong>{attendance?.timeOut || "Not yet"}</strong>
          </div>

          <div className="attendance-info-card">
            <span>Required Time In</span>
            <strong>{attendance?.requiredTimeIn || "-"}</strong>
          </div>

          <div className="attendance-info-card">
            <span>Total Hours</span>
            <strong>{attendance?.totalHours || 0}</strong>
          </div>

          <div className="attendance-info-card">
            <span>Gross Pay</span>
            <strong>{formatMoney(attendance?.grossPay)}</strong>
          </div>

          <div className="attendance-info-card">
            <span>Late</span>
            <strong>{formatMinutes(attendance?.lateMinutes)}</strong>
          </div>

          <div className="attendance-info-card">
            <span>Remarks</span>
            <strong>
              {attendance ? <StatusBadge record={attendance} /> : "No record yet"}
            </strong>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimeInOut;
