import { useEffect, useState } from "react";
import api from "../../api/axios";
import { useToast } from "../../context/ToastContext";
import StatusBadge from "../../components/StatusBadge";
import Spinner from "../../components/Spinner";
import Icon from "../../components/Icon";
import TimeOutValue from "../../components/TimeOutValue";
import { formatMoney, formatMinutes } from "../../utils/format";
import "../../styles/timeinout.css";

const TimeInOut = () => {
  const toast = useToast();

  // Results and errors are shown as toasts
  const setMessage = ({ type, text }) => {
    if (text) toast[type](text);
  };
  // attendance = today's record; openShift = the shift that can be timed
  // out now (today's, or last night's for a night shift); lastClosed = the
  // shift just completed, shown until the next refresh
  const [attendance, setAttendance] = useState(null);
  const [openShift, setOpenShift] = useState(null);
  const [lastClosed, setLastClosed] = useState(null);
  const [serverDate, setServerDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [network, setNetwork] = useState(null);
  const [checking, setChecking] = useState(true);
  const [now, setNow] = useState(new Date());

  // Is this device on the shop network? (only matters when the admin
  // turned the restriction on)
  const fetchNetworkStatus = async () => {
    try {
      const res = await api.get("/settings/network/status");
      setNetwork(res.data);
    } catch {
      setNetwork(null);
    }
  };

  useEffect(() => {
    fetchTodayAttendance();
    fetchNetworkStatus();

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
      // Fall back to today's record if the server didn't send openShift
      // (e.g. an older backend still running), so Time Out never locks up
      const today = res.data.attendance;
      const fallbackOpen = today?.timeIn && !today?.timeOut ? today : null;
      setOpenShift(res.data.openShift || fallbackOpen);
      setServerDate(res.data.date);
    } catch (error) {
      console.error("Error fetching attendance:", error);
    } finally {
      setChecking(false);
    }
  };

  // request = true when the shop Wi-Fi is unreachable: the time is still
  // recorded now, but it waits for the admin's approval
  const handleTimeIn = async (request = false) => {
    try {
      setLoading(true);
      setBusyAction("in");

      const res = await api.post(request ? "/attendance/request-time-in" : "/attendance/time-in");
      setLastClosed(null);
      setOpenShift(res.data.attendance);

      setMessage({
        type: request || res.data.attendance?.remarks === "Absent" ? "warning" : "success",
        text: res.data.message,
      });
      setAttendance(res.data.attendance);
    } catch (err) {
      if (/OUTSIDE_SHOP_NETWORK|^DEVICE_/.test(err.response?.data?.code || "")) fetchNetworkStatus();

      setMessage({
        type: "error",
        text: err.response?.data?.message || "Time in failed",
      });
    } finally {
      setLoading(false);
      setBusyAction("");
    }
  };

  const handleTimeOut = async (request = false) => {
    try {
      setLoading(true);
      setBusyAction("out");

      const res = await api.put(request ? "/attendance/request-time-out" : "/attendance/time-out");
      setOpenShift(null);
      setLastClosed(res.data.attendance);

      setMessage({ type: request ? "warning" : "success", text: res.data.message });
      if (res.data.attendance?.date === serverDate) setAttendance(res.data.attendance);
    } catch (err) {
      if (/OUTSIDE_SHOP_NETWORK|^DEVICE_/.test(err.response?.data?.code || "")) fetchNetworkStatus();

      setMessage({
        type: "error",
        text: err.response?.data?.message || "Time out failed",
      });
      // The record may have changed (e.g. edited or deleted by the admin):
      // reload so the screen matches the server
      if (err.response?.status === 400) fetchTodayAttendance();
    } finally {
      setLoading(false);
      setBusyAction("");
    }
  };

  const offNetwork = Boolean(network?.restricted && !network?.allowed);
  const device = network?.device;
  const deviceBlocked = Boolean(device?.enabled && !device?.ok);
  const willRegisterDevice = Boolean(device?.enabled && device?.ok && !device?.registered);
  // Record shown in the cards: the open shift, else today's, else the
  // shift just completed
  const shown = openShift || attendance || lastClosed;
  const canTimeIn = !attendance && !openShift;
  const canTimeOut = Boolean(openShift);
  const hasTimedIn = Boolean(attendance?.timeIn || openShift);
  const hasTimedOut = Boolean(attendance?.timeOut) && !openShift;
  const onShiftFromYesterday = Boolean(openShift && openShift.date !== serverDate);

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
        {offNetwork && (
          <div className="lp-alert warning network-banner">
            <Icon name="wifiOff" size={18} />
            <div>
              <strong>You're not connected to the shop Wi-Fi.</strong> Connect to the shop
              Wi-Fi, then{" "}
              <button type="button" className="link-btn" onClick={fetchNetworkStatus}>
                check again
              </button>
              . If the shop Wi-Fi is down, tap <strong>Request Time In / Time Out</strong>:
              the time is recorded now and counts once the admin approves it.
              {network?.ip && (
                <div className="lp-muted" style={{ marginTop: 6 }}>
                  Your connection: {network.ip}
                </div>
              )}
            </div>
          </div>
        )}

        {deviceBlocked && (
          <div className="lp-alert error network-banner">
            <Icon name="alert" size={18} />
            <div>
              <strong>
                {device.code === "DEVICE_TAKEN"
                  ? "This phone belongs to another employee."
                  : device.code === "DEVICE_MISMATCH"
                    ? "This isn't your registered phone."
                    : "Couldn't identify this phone."}
              </strong>{" "}
              {device.message}
              {device.label && device.code === "DEVICE_MISMATCH" && (
                <div className="lp-muted" style={{ marginTop: 6 }}>
                  Registered phone: {device.label}
                </div>
              )}
            </div>
          </div>
        )}

        {willRegisterDevice && (
          <div className="lp-alert info network-banner">
            <Icon name="info" size={18} />
            <div>
              Your next Time In or Time Out registers <strong>this phone</strong> as yours.
              After that, only this phone can record your time. On iPhone, keep using the same
              app (Safari <em>or</em> the home-screen icon).
            </div>
          </div>
        )}

        {network?.restricted && network?.allowed && (
          <span className="network-ok">
            <Icon name="wifi" size={14} /> Connected to the shop network
          </span>
        )}

        <div className="time-actions">
          <button
            className="time-in-btn"
            onClick={() => handleTimeIn(offNetwork)}
            disabled={loading || checking || !canTimeIn || deviceBlocked}
            aria-busy={busyAction === "in"}
          >
            {busyAction === "in" && <Spinner />}
            {busyAction === "in"
              ? "Recording..."
              : hasTimedIn
                ? "Timed In ✓"
                : offNetwork
                  ? "Request Time In"
                  : "Time In"}
          </button>

          <button
            className="time-out-btn"
            onClick={() => handleTimeOut(offNetwork)}
            disabled={loading || checking || !canTimeOut || deviceBlocked}
            aria-busy={busyAction === "out"}
          >
            {busyAction === "out" && <Spinner />}
            {busyAction === "out"
              ? "Recording..."
              : hasTimedOut
                ? "Timed Out ✓"
                : offNetwork && canTimeOut
                  ? "Request Time Out"
                  : "Time Out"}
          </button>
        </div>

        {onShiftFromYesterday && (
          <div className="attendance-message lp-alert info">
            You're on a shift that started <strong>{openShift.date}</strong> at{" "}
            <strong>{openShift.timeIn}</strong>. Tap <strong>Time Out</strong> when you finish.
          </div>
        )}

        {!checking && !attendance && !openShift && lastClosed?.timeOutNextDay && (
          <div className="attendance-message lp-alert success">
            Your shift from {lastClosed.date} {lastClosed.timeIn} is complete ({lastClosed.totalHours} hrs).
            You can time in again for your next shift.
          </div>
        )}

        {!checking && hasTimedIn && hasTimedOut && (
          <div className="attendance-message lp-alert info">
            Your attendance for today is complete. If something is wrong,
            send a DTR correction request from My Records.
          </div>
        )}

        <div className="attendance-info-grid">
          <div className="attendance-info-card">
            <span>Date</span>
            <strong>{shown?.date || serverDate || "No record"}</strong>
          </div>

          <div className="attendance-info-card">
            <span>Time In</span>
            <strong>{shown?.timeIn || "Not yet"}</strong>
            {shown?.timeInPending && <em className="pending-tag">Waiting for approval</em>}
          </div>

          <div className="attendance-info-card">
            <span>Time Out</span>
            <strong>
              <TimeOutValue record={shown} empty="Not yet" />
            </strong>
            {shown?.timeOutPending && <em className="pending-tag">Waiting for approval</em>}
          </div>

          <div className="attendance-info-card">
            <span>Required Time In</span>
            <strong>{shown?.requiredTimeIn || "-"}</strong>
          </div>

          <div className="attendance-info-card">
            <span>Total Hours</span>
            <strong>{shown?.totalHours || 0}</strong>
          </div>

          <div className="attendance-info-card">
            <span>Gross Pay</span>
            <strong>{formatMoney(shown?.grossPay)}</strong>
          </div>

          <div className="attendance-info-card">
            <span>Late</span>
            <strong>{formatMinutes(shown?.lateMinutes)}</strong>
          </div>

          <div className="attendance-info-card">
            <span>Remarks</span>
            <strong>
              {shown ? <StatusBadge record={shown} /> : "No record yet"}
            </strong>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimeInOut;
