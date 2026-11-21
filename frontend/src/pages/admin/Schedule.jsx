import { useEffect, useMemo, useState } from "react";
import api from "../../api/axios";
import Spinner from "../../components/Spinner";
import { useToast } from "../../context/ToastContext";
import "../../styles/schedule.css";

// Admin: monthly rest-day schedule. Every month starts blank (all work
// days); tap a day to make it a rest day. Past days also show who worked
// and who was absent (no time in by required time-in + 90 minutes).

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const currentMonth = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
  return parts.slice(0, 7);
};

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

const weekdayOf = (date) => new Date(`${date}T00:00:00Z`).getUTCDay();

const cellContent = (day) => {
  if (!day) return { label: "", className: "" };
  if (day.status === "worked") {
    if (day.remarks === "Absent") return { label: "A", className: "is-late-absent", title: "Timed in 90+ minutes late (Absent)" };
    return { label: day.rest ? "R✓" : "✓", className: "is-worked", title: day.rest ? "Worked on a rest day" : "Worked" };
  }
  if (day.status === "rest") return { label: "R", className: "is-rest", title: "Rest day" };
  if (day.status === "absent") return { label: "A", className: "is-absent", title: "Absent (no time in)" };
  return { label: "", className: "", title: "Work day" };
};

const Schedule = () => {
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyCell, setBusyCell] = useState("");
  const [fill, setFill] = useState({ employeeId: "", weekday: "0" });
  const [filling, setFilling] = useState("");
  const toast = useToast();

  const fetchSchedule = async (target = month) => {
    try {
      setLoading(true);
      const res = await api.get(`/schedule?month=${target}`);
      setData(res.data);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load the schedule.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedule(month);
  }, [month]);

  useEffect(() => {
    if (data?.employees?.length && !fill.employeeId) {
      setFill((current) => ({ ...current, employeeId: data.employees[0]._id }));
    }
  }, [data]);

  const restCounts = useMemo(() => {
    const counts = {};
    data?.employees?.forEach((emp) => {
      counts[emp._id] = Object.values(emp.days || {}).filter((d) => d.rest).length;
    });
    return counts;
  }, [data]);

  const toggleRest = async (employee, date) => {
    const day = employee.days?.[date];
    if (!day || day.locked) return;

    const key = `${employee._id}|${date}`;
    const rest = !day.rest;

    // Show the change right away
    setData((current) => ({
      ...current,
      employees: current.employees.map((emp) =>
        emp._id === employee._id
          ? {
              ...emp,
              days: {
                ...emp.days,
                [date]: {
                  ...day,
                  rest,
                  status: day.status === "worked" ? "worked" : rest ? "rest" : day.status === "rest" ? "upcoming" : day.status,
                },
              },
            }
          : emp
      ),
    }));

    try {
      setBusyCell(key);
      await api.put("/schedule/rest-day", { employeeId: employee._id, date, rest });
      await fetchSchedule(month);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update the rest day.");
      fetchSchedule(month);
    } finally {
      setBusyCell("");
    }
  };

  const runFill = async (rest) => {
    if (!fill.employeeId) return;

    try {
      setFilling(rest ? "set" : "clear");
      const res = await api.post("/schedule/fill", {
        employeeId: fill.employeeId,
        month,
        weekday: Number(fill.weekday),
        rest,
      });
      toast.success(res.data.message);
      fetchSchedule(month);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update rest days.");
    } finally {
      setFilling("");
    }
  };

  return (
    <div className="lp-page">
      <div className="lp-header">
        <div>
          <h1>Schedule</h1>
          <p>
            Tap a day to make it a rest day (tap again to undo). Each month starts blank: days
            without a rest day are work days, and a work day with no time in by required time in +
            90 minutes counts as <strong>Absent</strong>.
          </p>
        </div>
      </div>

      <div className="lp-card schedule-toolbar">
        <div className="schedule-month-nav">
          <button className="lp-btn secondary small" onClick={() => setMonth(shiftMonth(month, -1))}>
            ‹ Prev
          </button>
          <h2>{monthTitle(month)}</h2>
          <button className="lp-btn secondary small" onClick={() => setMonth(shiftMonth(month, 1))}>
            Next ›
          </button>
          {month !== currentMonth() && (
            <button className="link-btn" onClick={() => setMonth(currentMonth())}>
              This month
            </button>
          )}
        </div>

        <div className="schedule-fill">
          <span className="lp-muted">Quick fill:</span>
          <select
            value={fill.employeeId}
            onChange={(e) => setFill({ ...fill, employeeId: e.target.value })}
          >
            {data?.employees?.map((emp) => (
              <option key={emp._id} value={emp._id}>
                {emp.firstName} {emp.lastName}
              </option>
            ))}
          </select>
          <span className="lp-muted">every</span>
          <select value={fill.weekday} onChange={(e) => setFill({ ...fill, weekday: e.target.value })}>
            {WEEKDAYS.map((name, index) => (
              <option key={name} value={String(index)}>
                {name}
              </option>
            ))}
          </select>
          <button
            className="lp-btn small"
            onClick={() => runFill(true)}
            disabled={Boolean(filling) || !fill.employeeId}
            aria-busy={filling === "set"}
          >
            {filling === "set" && <Spinner />}
            Set as rest days
          </button>
          <button
            className="lp-btn secondary small"
            onClick={() => runFill(false)}
            disabled={Boolean(filling) || !fill.employeeId}
            aria-busy={filling === "clear"}
          >
            {filling === "clear" && <Spinner />}
            Clear
          </button>
        </div>

        <div className="schedule-legend">
          <span><i className="is-rest">R</i> Rest day</span>
          <span><i className="is-worked">✓</i> Worked</span>
          <span><i className="is-absent">A</i> Absent</span>
          <span><i className="is-locked" /> In a payroll (locked)</span>
        </div>
      </div>

      <div className="lp-card schedule-card">
        {loading && !data ? (
          <div className="lp-empty">
            <Spinner /> Loading schedule...
          </div>
        ) : !data?.employees?.length ? (
          <div className="lp-empty">No active employees.</div>
        ) : (
          <div className="schedule-scroll">
            <table className="schedule-grid">
              <thead>
                <tr>
                  <th className="schedule-name-col">Employee</th>
                  {data.dates.map((date) => (
                    <th
                      key={date}
                      className={`${date === data.today ? "is-today" : ""} ${weekdayOf(date) === 0 ? "is-sunday" : ""}`}
                    >
                      <span>{Number(date.slice(8))}</span>
                      <small>{WEEKDAYS[weekdayOf(date)].slice(0, 2)}</small>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.employees.map((emp) => (
                  <tr key={emp._id}>
                    <th className="schedule-name-col">
                      <strong>
                        {emp.firstName} {emp.lastName}
                      </strong>
                      <small className="lp-muted">
                        {emp.requiredTimeIn} · {restCounts[emp._id] || 0} rest
                      </small>
                    </th>
                    {data.dates.map((date) => {
                      const day = emp.days?.[date];
                      const content = cellContent(day);
                      const key = `${emp._id}|${date}`;

                      return (
                        <td key={date} className={date === data.today ? "is-today" : ""}>
                          <button
                            type="button"
                            className={`schedule-cell ${content.className} ${day?.locked ? "is-locked" : ""}`}
                            onClick={() => toggleRest(emp, date)}
                            disabled={!day || day.locked || busyCell === key}
                            title={`${emp.firstName} · ${date}: ${day?.locked ? "in a generated payroll" : content.title}`}
                          >
                            {busyCell === key ? <Spinner /> : content.label}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Schedule;
