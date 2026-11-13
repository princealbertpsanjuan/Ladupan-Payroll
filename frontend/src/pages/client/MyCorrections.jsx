import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../api/axios";
import Spinner from "../../components/Spinner";
import { useToast } from "../../context/ToastContext";
import { formatDateTime } from "../../utils/format";
import { SkeletonRows } from "../../components/Skeleton";

const emptyForm = {
  date: "",
  requestedTimeIn: "",
  requestedTimeOut: "",
  reason: "",
};

const MyCorrections = () => {
  const [searchParams] = useSearchParams();

  const [corrections, setCorrections] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const toast = useToast();

  // Results and errors are shown as toasts
  const setMessage = ({ type, text }) => {
    if (text) toast[type](text);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      const [correctionRes, recordRes] = await Promise.all([
        api.get("/corrections/my"),
        api.get("/attendance/my-records"),
      ]);

      const recordList = Array.isArray(recordRes.data) ? recordRes.data : [];

      setCorrections(Array.isArray(correctionRes.data) ? correctionRes.data : []);
      setRecords(recordList);

      // Opened from "Request Correction" on My Records
      const date = searchParams.get("date");

      if (date) {
        const record = recordList.find((item) => item.date === date);

        setForm({
          date,
          requestedTimeIn: record?.timeIn || "",
          requestedTimeOut: record?.timeOut || "",
          reason: "",
        });
        setShowForm(true);
      }
    } catch (error) {
      console.error("Error fetching corrections:", error);
    } finally {
      setLoading(false);
    }
  };

  const currentRecord = records.find((record) => record.date === form.date);

  const handleChange = (e) => {
    const { name, value } = e.target;

    // Picking a date fills in the times currently on that DTR
    if (name === "date") {
      const record = records.find((item) => item.date === value);

      setForm({
        ...form,
        date: value,
        requestedTimeIn: record?.timeIn || form.requestedTimeIn,
        requestedTimeOut: record?.timeOut || form.requestedTimeOut,
      });
      return;
    }

    setForm({ ...form, [name]: value });
  };

  const submitRequest = async (e) => {
    e.preventDefault();
    setMessage({ type: "", text: "" });

    try {
      setSaving(true);

      const res = await api.post("/corrections", form);

      setMessage({ type: "success", text: res.data.message });
      setForm(emptyForm);
      setShowForm(false);
      fetchData();
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.message || "Failed to submit request.",
      });
    } finally {
      setSaving(false);
    }
  };

  const cancelRequest = async (correction) => {
    try {
      await api.delete(`/corrections/my/${correction._id}`);
      setMessage({ type: "success", text: "Request cancelled." });
      fetchData();
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.message || "Failed to cancel request.",
      });
    }
  };

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

  return (
    <div className="lp-page">
      <div className="lp-header">
        <div>
          <h1>DTR Correction Requests</h1>
          <p>
            Forgot to time out, or a time is wrong? Ask the admin to correct
            your DTR.
          </p>
        </div>

        {!showForm && (
          <button className="lp-btn" onClick={() => setShowForm(true)}>
            + New Request
          </button>
        )}
      </div>

      {showForm && (
        <div className="lp-card">
          <h2>New Correction Request</h2>
          <p className="lp-card-subtitle">
            Only records not yet included in a payroll can be corrected.
          </p>

          <form className="lp-form" onSubmit={submitRequest} style={{ maxWidth: 560 }}>
            <div className="lp-field">
              <label>Date</label>
              <input
                type="date"
                name="date"
                max={today}
                value={form.date}
                onChange={handleChange}
                required
              />
              {form.date && (
                <small>
                  {currentRecord
                    ? `Current record: in ${currentRecord.timeIn || "-"}, out ${currentRecord.timeOut || "-"}`
                    : "You have no record on this date. Approving this request will add one."}
                </small>
              )}
            </div>

            <div className="lp-form-grid">
              <div className="lp-field">
                <label>Correct Time In</label>
                <input
                  type="time"
                  name="requestedTimeIn"
                  value={form.requestedTimeIn}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="lp-field">
                <label>Correct Time Out</label>
                <small>Night shift? A time out earlier than the time in counts as the next day.</small>
                <input
                  type="time"
                  name="requestedTimeOut"
                  value={form.requestedTimeOut}
                  onChange={handleChange}
                  required={Boolean(form.date) && form.date < today}
                />
              </div>
            </div>

            <div className="lp-field">
              <label>Reason</label>
              <textarea
                name="reason"
                placeholder="e.g. I forgot to time out before leaving at 5:00 PM."
                value={form.reason}
                onChange={handleChange}
                required
              />
            </div>

            <div className="lp-btn-row">
              <button type="submit" className="lp-btn" disabled={saving}aria-busy={saving}>
                {saving && <Spinner />}
                {saving ? "Submitting..." : "Submit Request"}
              </button>

              <button
                type="button"
                className="lp-btn secondary"
                onClick={() => {
                  setShowForm(false);
                  setForm(emptyForm);
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="lp-card">
        <h2>My Requests</h2>

        <div className="lp-table-wrap">
          <table className="lp-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Before</th>
                <th>Requested</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Admin Note</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <SkeletonRows rows={6} cols={7} />
              ) : corrections.length > 0 ? (
                corrections.map((correction) => (
                  <tr key={correction._id}>
                    <td className="lp-nowrap">
                      {correction.date}
                      <div className="lp-muted">Sent {formatDateTime(correction.createdAt)}</div>
                    </td>
                    <td className="lp-nowrap">
                      {correction.originalTimeIn || "-"} – {correction.originalTimeOut || "-"}
                    </td>
                    <td className="lp-nowrap">
                      <strong>
                        {correction.requestedTimeIn} – {correction.requestedTimeOut || "-"}
                      </strong>
                    </td>
                    <td style={{ minWidth: 200 }}>{correction.reason}</td>
                    <td>
                      <span className={`lp-badge ${correction.status}`}>
                        {correction.status}
                      </span>
                    </td>
                    <td style={{ minWidth: 160 }}>{correction.adminNote || "-"}</td>
                    <td>
                      {correction.status === "pending" ? (
                        <button
                          className="lp-btn secondary small"
                          onClick={() => cancelRequest(correction)}
                        >
                          Cancel
                        </button>
                      ) : (
                        <span className="lp-muted">
                          {formatDateTime(correction.reviewedAt)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="lp-empty">
                    You have not sent any correction requests.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MyCorrections;
