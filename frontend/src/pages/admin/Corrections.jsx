import { useEffect, useState } from "react";
import api from "../../api/axios";
import { formatDateTime, getEmployeeName } from "../../utils/format";

const TABS = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "", label: "All" },
];

const Corrections = () => {
  const [corrections, setCorrections] = useState([]);
  const [status, setStatus] = useState("pending");
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState({ type: "", text: "" });

  // Review modal
  const [reviewing, setReviewing] = useState(null);
  const [reviewAction, setReviewAction] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCorrections();
  }, [status]);

  const fetchCorrections = async () => {
    try {
      setLoading(true);

      const [listRes, pendingRes] = await Promise.all([
        api.get("/corrections", { params: status ? { status } : {} }),
        api.get("/corrections", { params: { status: "pending" } }),
      ]);

      setCorrections(Array.isArray(listRes.data) ? listRes.data : []);
      setPendingCount(Array.isArray(pendingRes.data) ? pendingRes.data.length : 0);
    } catch (error) {
      console.error("Error fetching corrections:", error);
    } finally {
      setLoading(false);
    }
  };

  const openReview = (correction, action) => {
    setReviewing(correction);
    setReviewAction(action);
    setAdminNote("");
    setReviewError("");
  };

  const closeReview = () => {
    setReviewing(null);
    setReviewAction("");
    setReviewError("");
  };

  const submitReview = async () => {
    try {
      setSaving(true);
      setReviewError("");

      const res = await api.put(`/corrections/${reviewing._id}/${reviewAction}`, {
        adminNote,
      });

      setMessage({ type: "success", text: res.data.message });
      closeReview();
      fetchCorrections();
    } catch (error) {
      setReviewError(error.response?.data?.message || "Failed to review request.");
    } finally {
      setSaving(false);
    }
  };

  const filteredCorrections = corrections.filter((correction) => {
    const keyword = search.toLowerCase();
    return (
      !keyword ||
      getEmployeeName(correction.employee).toLowerCase().includes(keyword) ||
      (correction.employee?.employeeId || "").toLowerCase().includes(keyword) ||
      correction.date.includes(keyword)
    );
  });

  return (
    <div className="lp-page">
      <div className="lp-header">
        <div>
          <h1>DTR Corrections</h1>
          <p>
            Review employee requests to fix a wrong or missing time entry.
            Approving updates their DTR automatically.
          </p>
        </div>
      </div>

      {message.text && <div className={`lp-alert ${message.type}`}>{message.text}</div>}

      <div className="lp-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.label}
            className={`lp-tab ${status === tab.value ? "active" : ""}`}
            onClick={() => setStatus(tab.value)}
          >
            {tab.label}
            {tab.value === "pending" && pendingCount > 0 && (
              <span className="lp-count">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      <div className="lp-card">
        <div className="lp-toolbar">
          <input
            type="text"
            placeholder="Search by employee name, ID, or date..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="lp-table-wrap">
          <table className="lp-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Date</th>
                <th>Current DTR</th>
                <th>Requested</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="lp-empty">
                    Loading requests...
                  </td>
                </tr>
              ) : filteredCorrections.length > 0 ? (
                filteredCorrections.map((correction) => (
                  <tr key={correction._id}>
                    <td>
                      <strong>{getEmployeeName(correction.employee)}</strong>
                      <div className="lp-muted">{correction.employee?.employeeId}</div>
                    </td>
                    <td className="lp-nowrap">
                      {correction.date}
                      <div className="lp-muted">Sent {formatDateTime(correction.createdAt)}</div>
                    </td>
                    <td className="lp-nowrap">
                      {correction.originalTimeIn || correction.originalTimeOut
                        ? `${correction.originalTimeIn || "-"} – ${correction.originalTimeOut || "-"}`
                        : "No record"}
                    </td>
                    <td className="lp-nowrap">
                      <strong>
                        {correction.requestedTimeIn} – {correction.requestedTimeOut || "-"}
                      </strong>
                    </td>
                    <td style={{ minWidth: 220 }}>{correction.reason}</td>
                    <td>
                      <span className={`lp-badge ${correction.status}`}>
                        {correction.status}
                      </span>
                      {correction.adminNote && (
                        <div className="lp-muted" style={{ marginTop: 6 }}>
                          Note: {correction.adminNote}
                        </div>
                      )}
                    </td>
                    <td>
                      {correction.status === "pending" ? (
                        <div className="lp-btn-row">
                          <button
                            className="lp-btn success small"
                            onClick={() => openReview(correction, "approve")}
                          >
                            Approve
                          </button>
                          <button
                            className="lp-btn danger small"
                            onClick={() => openReview(correction, "reject")}
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="lp-muted">
                          {correction.reviewedBy
                            ? `${getEmployeeName(correction.reviewedBy)}, `
                            : ""}
                          {formatDateTime(correction.reviewedAt)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="lp-empty">
                    No {status || ""} correction requests.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {reviewing && (
        <div className="lp-modal-overlay">
          <div className="lp-modal">
            <div className="lp-modal-header">
              <div>
                <h2>
                  {reviewAction === "approve" ? "Approve" : "Reject"} Correction
                </h2>
                <p>
                  {getEmployeeName(reviewing.employee)} · {reviewing.date}
                </p>
              </div>
              <button className="lp-modal-close" onClick={closeReview}>
                ×
              </button>
            </div>

            <div className="lp-details">
              <div>
                <span>Current DTR</span>
                <strong>
                  {reviewing.originalTimeIn || "-"} – {reviewing.originalTimeOut || "-"}
                </strong>
              </div>
              <div>
                <span>Requested</span>
                <strong>
                  {reviewing.requestedTimeIn} – {reviewing.requestedTimeOut || "-"}
                </strong>
              </div>
            </div>

            <p style={{ marginBottom: 14, color: "#333" }}>
              <strong>Reason:</strong> {reviewing.reason}
            </p>

            {reviewAction === "approve" && (
              <div className="lp-alert info">
                The DTR will be updated to the requested times, and remarks,
                hours, and pay will be recalculated.
              </div>
            )}

            {reviewError && <div className="lp-alert error">{reviewError}</div>}

            <div className="lp-field">
              <label>Note to employee (optional)</label>
              <textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder={
                  reviewAction === "approve"
                    ? "e.g. Confirmed with supervisor."
                    : "e.g. CCTV shows you left at 4:00 PM."
                }
              />
            </div>

            <div className="lp-modal-actions">
              <button className="lp-btn secondary" onClick={closeReview}>
                Cancel
              </button>
              <button
                className={`lp-btn ${reviewAction === "approve" ? "success" : "danger"}`}
                onClick={submitReview}
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : reviewAction === "approve"
                  ? "Approve & Update DTR"
                  : "Reject Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Corrections;
