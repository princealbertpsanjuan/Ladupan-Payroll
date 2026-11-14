import { useEffect, useState } from "react";
import api from "../api/axios";
import Spinner from "./Spinner";
import TimeOutValue from "./TimeOutValue";
import { useToast } from "../context/ToastContext";
import { getEmployeeName, formatDateTime } from "../utils/format";

// Admin: Time In / Time Out requests sent while the shop Wi-Fi was down.
// The time was recorded by the server when the employee tapped the button;
// approving makes it count for payroll.
const TimeRequestsCard = ({ onChange }) => {
  const [requests, setRequests] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [rejecting, setRejecting] = useState(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const toast = useToast();

  const fetchRequests = async () => {
    try {
      const res = await api.get("/attendance/pending-requests");
      setRequests(Array.isArray(res.data) ? res.data : []);
      onChange?.(Array.isArray(res.data) ? res.data.length : 0);
    } catch (err) {
      console.error("Error fetching time requests:", err);
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const approve = async (record) => {
    try {
      setBusyId(record._id);
      const res = await api.put(`/attendance/${record._id}/approve-request`);
      toast.success(res.data.message);
      fetchRequests();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to approve.");
    } finally {
      setBusyId("");
    }
  };

  const confirmReject = async () => {
    try {
      setBusyId(rejecting._id);
      setError("");
      const res = await api.put(`/attendance/${rejecting._id}/reject-request`, { note });
      toast.success(res.data.message);
      setRejecting(null);
      fetchRequests();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to reject.");
    } finally {
      setBusyId("");
    }
  };

  if (!loaded || requests.length === 0) return null;

  return (
    <div className="lp-card">
      <h2>
        Time requests <span className="lp-count">{requests.length}</span>
      </h2>
      <p className="lp-card-subtitle">
        Sent with <strong>Request Time In / Time Out</strong> while the employee wasn't on the shop
        Wi-Fi. The time shown is when they tapped the button. Until you approve, these DTRs are left
        out of payroll.
      </p>

      <div className="lp-table-wrap">
        <table className="lp-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Date</th>
              <th>Time In</th>
              <th>Time Out</th>
              <th>Sent from</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((record) => (
              <tr key={record._id}>
                <td>
                  <strong>{getEmployeeName(record.employee)}</strong>
                  <div className="lp-muted">{record.employee?.employeeId}</div>
                </td>
                <td className="lp-nowrap">
                  {record.date}
                  <div className="lp-muted">Updated {formatDateTime(record.updatedAt)}</div>
                </td>
                <td className="lp-nowrap">
                  {record.timeIn || "-"}
                  {record.timeInPending && <div className="lp-badge pending" style={{ marginTop: 4 }}>Requested</div>}
                </td>
                <td className="lp-nowrap">
                  <TimeOutValue record={record} empty="Not yet" />
                  {record.timeOutPending && <div className="lp-badge pending" style={{ marginTop: 4 }}>Requested</div>}
                </td>
                <td className="lp-nowrap lp-muted">
                  {[record.requestInfo?.timeInIp, record.requestInfo?.timeOutIp]
                    .filter(Boolean)
                    .filter((ip, i, all) => all.indexOf(ip) === i)
                    .join(", ") || "-"}
                </td>
                <td>
                  <div className="lp-btn-row">
                    <button
                      className="lp-btn success small"
                      onClick={() => approve(record)}
                      disabled={busyId === record._id}
                      aria-busy={busyId === record._id}
                    >
                      {busyId === record._id && <Spinner />}
                      Approve
                    </button>
                    <button
                      className="lp-btn danger small"
                      onClick={() => {
                        setRejecting(record);
                        setNote("");
                        setError("");
                      }}
                      disabled={busyId === record._id}
                    >
                      Reject
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rejecting && (
        <div className="lp-modal-overlay">
          <div className="lp-modal">
            <div className="lp-modal-header">
              <div>
                <h2>Reject time request</h2>
                <p>
                  {getEmployeeName(rejecting.employee)} · {rejecting.date}
                </p>
              </div>
              <button className="lp-modal-close" onClick={() => setRejecting(null)}>
                ×
              </button>
            </div>

            <div className="lp-alert warning">
              {rejecting.timeInPending
                ? "The requested Time In is rejected, so this DTR record will be removed."
                : "The requested Time Out will be cleared, so the shift is open again. You can set the correct time out in Attendance."}
            </div>

            {error && <div className="lp-alert error">{error}</div>}

            <div className="lp-field">
              <label>Note to employee (optional)</label>
              <textarea
                value={note}
                maxLength={300}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. You weren't at the shop at that time."
              />
            </div>

            <div className="lp-modal-actions">
              <button className="lp-btn secondary" onClick={() => setRejecting(null)}>
                Cancel
              </button>
              <button
                className="lp-btn danger"
                onClick={confirmReject}
                disabled={Boolean(busyId)}
                aria-busy={Boolean(busyId)}
              >
                {busyId && <Spinner />}
                {busyId ? "Saving..." : "Reject Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimeRequestsCard;
