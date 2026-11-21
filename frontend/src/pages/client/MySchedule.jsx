import { useEffect, useState } from "react";
import api from "../../api/axios";
import Spinner from "../../components/Spinner";
import "../../styles/schedule.css";

// Employee: rest days set by the admin for the month, plus worked and
// absent days.

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const currentMonth = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit" })
    .format(new Date())
    .slice(0, 7);

const shiftMonth = (month, delta) => {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
};

const monthTitle = (month) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

const STATUS_TEXT = {
  rest: "Rest day",
  worked: "Worked",
  absent: "Absent",
};

const MySchedule = () => {
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const res = await api.get(`/schedule/mine?month=${month}`);
        setData(res.data);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load your schedule.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [month]);

  const days = data?.days || {};
  const dates = data?.dates || [];
  const leadingBlanks = dates.length ? new Date(`${dates[0]}T00:00:00Z`).getUTCDay() : 0;
  const restDates = dates.filter((date) => days[date]?.rest);
  const absentDates = dates.filter((date) => days[date]?.status === "absent");

  return (
    <div className="lp-page">
      <div className="lp-header">
        <div>
          <h1>My Schedule</h1>
          <p>
            Your rest days for the month. Every other day is a work day: if you don't time in within
            90 minutes of your required time in{data?.requiredTimeIn ? ` (${data.requiredTimeIn})` : ""}
            , that day counts as Absent.
          </p>
        </div>
      </div>

      <div className="lp-card">
        <div className="schedule-month-nav">
          <button className="lp-btn secondary small" onClick={() => setMonth(shiftMonth(month, -1))}>
            ‹ Prev
          </button>
          <h2>{monthTitle(month)}</h2>
          <button className="lp-btn secondary small" onClick={() => setMonth(shiftMonth(month, 1))}>
            Next ›
          </button>
        </div>

        {error && <div className="lp-alert error">{error}</div>}

        {loading && !data ? (
          <div className="lp-empty">
            <Spinner /> Loading...
          </div>
        ) : (
          <>
            <div className="my-calendar">
              {WEEKDAY_SHORT.map((name) => (
                <div key={name} className="my-calendar-head">
                  {name}
                </div>
              ))}
              {Array.from({ length: leadingBlanks }).map((_, i) => (
                <div key={`blank-${i}`} />
              ))}
              {dates.map((date) => {
                const day = days[date] || {};
                const status = day.status === "worked" && day.remarks === "Absent" ? "absent" : day.status;
                return (
                  <div
                    key={date}
                    className={`my-calendar-day is-${status || "none"} ${day.rest ? "has-rest" : ""} ${date === data?.today ? "is-today" : ""}`}
                  >
                    <strong>{Number(date.slice(8))}</strong>
                    <small>{day.rest && status === "worked" ? "Rest · worked" : STATUS_TEXT[status] || ""}</small>
                  </div>
                );
              })}
            </div>

            <div className="my-schedule-summary">
              <p>
                <strong>Rest days:</strong>{" "}
                {restDates.length
                  ? restDates.map((date) => Number(date.slice(8))).join(", ")
                  : "None set yet: every day is a work day."}
              </p>
              {absentDates.length > 0 && (
                <p>
                  <strong>Absent:</strong> {absentDates.map((date) => Number(date.slice(8))).join(", ")}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MySchedule;
