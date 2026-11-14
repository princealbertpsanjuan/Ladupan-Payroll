import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../api/axios";
import { formatDateTime } from "../../utils/format";
import { SkeletonRows } from "../../components/Skeleton";

// Readable names for action codes
const ACTION_LABELS = {
  ADMIN_REGISTERED: "Admin registered",
  EMPLOYEE_CREATED: "Employee created",
  EMPLOYEE_UPDATED: "Employee updated",
  EMPLOYEE_ACTIVATED: "Employee activated",
  EMPLOYEE_DEACTIVATED: "Employee deactivated",
  EMPLOYEE_PASSWORD_RESET: "Password reset by admin",
  EMPLOYEE_DELETED: "Employee deleted",
  PASSWORD_CHANGED: "Password changed",
  EMAIL_CHANGED: "Email changed",
  NAME_CHANGED: "Name changed",
  ATTENDANCE_CREATED: "DTR added",
  ATTENDANCE_UPDATED: "DTR edited",
  ATTENDANCE_DELETED: "DTR deleted",
  PAYROLL_GENERATED: "Payroll generated",
  CASH_ADVANCE_ADDED: "Cash advance recorded",
  CASH_ADVANCE_DELETED: "Cash advance deleted",
  CORRECTION_SUBMITTED: "Correction requested",
  CORRECTION_CANCELLED: "Correction cancelled",
  CORRECTION_APPROVED: "Correction approved",
  CORRECTION_REJECTED: "Correction rejected",
  ATTENDANCE_BLOCKED_NETWORK: "Blocked: outside shop network",
  NETWORK_RESTRICTION_ON: "Shop network restriction on",
  NETWORK_RESTRICTION_OFF: "Shop network restriction off",
  NETWORK_ADDED: "Allowed network added",
  NETWORK_REMOVED: "Allowed network removed",
  TIME_IN_REQUESTED: "Time in requested (off Wi-Fi)",
  TIME_OUT_REQUESTED: "Time out requested (off Wi-Fi)",
  TIME_REQUEST_APPROVED: "Time request approved",
  TIME_REQUEST_REJECTED: "Time request rejected",
  ATTENDANCE_BLOCKED_DEVICE: "Blocked: unregistered phone",
  DEVICE_REGISTERED: "Phone registered",
  DEVICE_RESET: "Registered phone reset",
  DEVICE_BINDING_ON: "Device lock on",
  DEVICE_BINDING_OFF: "Device lock off",
};

const actionLabel = (action) => ACTION_LABELS[action] || action;

const AuditLog = () => {
  const [logs, setLogs] = useState([]);
  const [actions, setActions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [searchParams] = useSearchParams();

  const [filters, setFilters] = useState({
    search: "",
    action: searchParams.get("action") || "",
    from: "",
    to: "",
  });
  const [appliedFilters, setAppliedFilters] = useState(filters);

  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    fetchLogs();
  }, [page, appliedFilters]);

  const fetchLogs = async () => {
    try {
      setLoading(true);

      const params = { page, limit: 25 };
      Object.entries(appliedFilters).forEach(([key, value]) => {
        if (value) params[key] = value;
      });

      const res = await api.get("/audit-logs", { params });

      setLogs(res.data.logs || []);
      setTotal(res.data.total || 0);
      setPages(res.data.pages || 1);
      setActions(res.data.actions || []);
    } catch (error) {
      console.error("Error fetching audit log:", error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = (e) => {
    e.preventDefault();
    setPage(1);
    setAppliedFilters(filters);
  };

  const resetFilters = () => {
    const empty = { search: "", action: "", from: "", to: "" };
    setFilters(empty);
    setAppliedFilters(empty);
    setPage(1);
  };

  return (
    <div className="lp-page">
      <div className="lp-header">
        <div>
          <h1>Audit Log</h1>
          <p>
            A record of who changed what: employees, DTRs, payroll, cash
            advances, and correction requests.
          </p>
        </div>
      </div>

      <div className="lp-card">
        <form className="lp-toolbar" onSubmit={applyFilters}>
          <input
            type="text"
            placeholder="Search description or user..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />

          <select
            value={filters.action}
            onChange={(e) => setFilters({ ...filters, action: e.target.value })}
          >
            <option value="">All Actions</option>
            {actions.map((action) => (
              <option key={action} value={action}>
                {actionLabel(action)}
              </option>
            ))}
          </select>

          <input
            type="date"
            title="From"
            value={filters.from}
            onChange={(e) => setFilters({ ...filters, from: e.target.value })}
          />

          <input
            type="date"
            title="To"
            value={filters.to}
            min={filters.from || undefined}
            onChange={(e) => setFilters({ ...filters, to: e.target.value })}
          />

          <button type="submit" className="lp-btn">
            Filter
          </button>

          <button type="button" className="lp-btn secondary" onClick={resetFilters}>
            Reset
          </button>
        </form>

        <div className="lp-table-wrap">
          <table className="lp-table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>User</th>
                <th>Action</th>
                <th>Description</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <SkeletonRows rows={6} cols={5} />
              ) : logs.length > 0 ? (
                logs.map((log) => (
                  <tr key={log._id}>
                    <td className="lp-nowrap">{formatDateTime(log.createdAt)}</td>
                    <td className="lp-nowrap">
                      {log.actorName}
                      <div className="lp-muted">{log.actorRole}</div>
                    </td>
                    <td>
                      <span className="lp-badge">{actionLabel(log.action)}</span>
                    </td>
                    <td style={{ minWidth: 280 }}>{log.description}</td>
                    <td>
                      {log.details && Object.keys(log.details).length > 0 && (
                        <button
                          className="lp-btn secondary small"
                          onClick={() => setSelectedLog(log)}
                        >
                          Details
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="lp-empty">
                    No audit log entries found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="lp-pagination">
          <span>
            {total} entr{total === 1 ? "y" : "ies"} · Page {page} of {pages}
          </span>

          <div className="lp-btn-row">
            <button
              className="lp-btn secondary small"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              ← Previous
            </button>
            <button
              className="lp-btn secondary small"
              disabled={page >= pages}
              onClick={() => setPage(page + 1)}
            >
              Next →
            </button>
          </div>
        </div>
      </div>

      {selectedLog && (
        <div className="lp-modal-overlay">
          <div className="lp-modal wide">
            <div className="lp-modal-header">
              <div>
                <h2>{actionLabel(selectedLog.action)}</h2>
                <p>
                  {selectedLog.actorName} · {formatDateTime(selectedLog.createdAt)}
                </p>
              </div>
              <button className="lp-modal-close" onClick={() => setSelectedLog(null)}>
                ×
              </button>
            </div>

            <p style={{ marginBottom: 14 }}>{selectedLog.description}</p>

            {selectedLog.details?.changes && (
              <div className="lp-table-wrap" style={{ marginBottom: 14 }}>
                <table className="lp-table">
                  <thead>
                    <tr>
                      <th>Field</th>
                      <th>Before</th>
                      <th>After</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(selectedLog.details.changes).map(([field, change]) => (
                      <tr key={field}>
                        <td>{field}</td>
                        <td>{String(change.from ?? "-")}</td>
                        <td>{String(change.to ?? "-")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {(selectedLog.details?.before !== undefined || selectedLog.details?.after) && (
              <div className="lp-form-grid" style={{ marginBottom: 14 }}>
                <div>
                  <strong>Before</strong>
                  <pre className="lp-pre">
                    {selectedLog.details.before
                      ? JSON.stringify(selectedLog.details.before, null, 2)
                      : "No record"}
                  </pre>
                </div>
                <div>
                  <strong>After</strong>
                  <pre className="lp-pre">
                    {selectedLog.details.after
                      ? JSON.stringify(selectedLog.details.after, null, 2)
                      : "Deleted"}
                  </pre>
                </div>
              </div>
            )}

            <details>
              <summary className="lp-muted" style={{ cursor: "pointer" }}>
                All recorded details
              </summary>
              <pre className="lp-pre" style={{ marginTop: 8 }}>
                {JSON.stringify(selectedLog.details, null, 2)}
              </pre>
            </details>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLog;
