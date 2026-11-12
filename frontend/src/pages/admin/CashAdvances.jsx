import { useEffect, useRef, useState } from "react";
import SortableTh from "../../components/SortableTh";
import useSort from "../../hooks/useSort";
import useFlipList from "../../hooks/useFlipList";
import api from "../../api/axios";
import Spinner from "../../components/Spinner";
import { useToast } from "../../context/ToastContext";
import { formatMoney, formatDateTime, getEmployeeName } from "../../utils/format";
import { SkeletonRows } from "../../components/Skeleton";

const todayLocal = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

const emptyForm = () => ({
  employee: "",
  amount: "",
  date: todayLocal(),
  note: "",
});

const SORT_ACCESSORS = {
  employeeId: (emp) => emp.employeeId || "",
  name: (emp) => getEmployeeName(emp).toLowerCase(),
  totalAdvances: (emp) => Number(emp.totalAdvances || 0),
  totalDeductions: (emp) => Number(emp.totalDeductions || 0),
  balance: (emp) => Number(emp.balance || 0),
};

const CashAdvances = () => {
  const tbodyRef = useRef(null);
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [balanceFilter, setBalanceFilter] = useState("all");
  const toast = useToast();

  // Results and errors are shown as toasts
  const setMessage = ({ type, text }) => {
    if (text) toast[type](text);
  };

  // Add advance modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // Ledger modal
  const [ledger, setLedger] = useState(null);
  const [ledgerError, setLedgerError] = useState("");

  useEffect(() => {
    fetchSummary();
  }, []);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const res = await api.get("/cash-advances");
      setSummary(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.message || "Failed to load cash advances.",
      });
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = (employeeId = "") => {
    setForm({ ...emptyForm(), employee: employeeId });
    setFormError("");
    setShowAddModal(true);
  };

  const saveAdvance = async (e) => {
    e.preventDefault();
    setFormError("");

    try {
      setSaving(true);
      const res = await api.post("/cash-advances", form);

      const employee = summary.find((emp) => emp._id === form.employee);

      setMessage({
        type: "success",
        text: `Recorded ${formatMoney(form.amount)} for ${getEmployeeName(employee)}. New balance: ${formatMoney(res.data.balance)}.`,
      });

      setShowAddModal(false);
      fetchSummary();
    } catch (error) {
      setFormError(error.response?.data?.message || "Failed to record cash advance.");
    } finally {
      setSaving(false);
    }
  };

  const openLedger = async (employeeId) => {
    try {
      setLedgerError("");
      const res = await api.get(`/cash-advances/employee/${employeeId}`);
      setLedger(res.data);
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.message || "Failed to load ledger.",
      });
    }
  };

  const deleteEntry = async (entry) => {
    if (!window.confirm(`Delete the ${formatMoney(entry.amount)} cash advance from ${entry.date}?`)) {
      return;
    }

    try {
      setLedgerError("");
      await api.delete(`/cash-advances/${entry._id}`);
      setMessage({ type: "success", text: "Cash advance entry deleted." });
      openLedger(ledger.employee._id);
      fetchSummary();
    } catch (error) {
      setLedgerError(error.response?.data?.message || "Failed to delete entry.");
    }
  };

  const totalOutstanding = summary.reduce((sum, emp) => sum + Math.max(emp.balance, 0), 0);
  const withBalance = summary.filter((emp) => emp.balance > 0).length;

  const filteredSummary = summary.filter((emp) => {
    const keyword = search.toLowerCase();
    const matchesSearch =
      !keyword ||
      getEmployeeName(emp).toLowerCase().includes(keyword) ||
      (emp.employeeId || "").toLowerCase().includes(keyword);

    const matchesBalance =
      balanceFilter === "all" ||
      (balanceFilter === "unpaid" && emp.balance > 0) ||
      (balanceFilter === "none" && emp.balance <= 0);

    return matchesSearch && matchesBalance;
  });

  const { sortedRows, sort, toggleSort } = useSort(filteredSummary, SORT_ACCESSORS);

  useFlipList(tbodyRef, `${sort.key}-${sort.direction}-${search}-${balanceFilter}`);

  return (
    <div className="lp-page">
      <div className="lp-header">
        <div>
          <h1>Cash Advances</h1>
          <p>
            Record cash advances and track what has been paid back through
            payroll.
          </p>
        </div>

        <button className="lp-btn" onClick={() => openAddModal()}>
          + Record Cash Advance
        </button>
      </div>

      <div className="lp-stat-grid">
        <div className="lp-stat">
          <span>Total Unpaid Balance</span>
          <strong>{formatMoney(totalOutstanding)}</strong>
        </div>
        <div className="lp-stat">
          <span>Employees with Unpaid Balance</span>
          <strong>{withBalance}</strong>
        </div>
      </div>

      <div className="lp-card">
        <div className="lp-toolbar">
          <input
            type="text"
            placeholder="Search employee by name or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select value={balanceFilter} onChange={(e) => setBalanceFilter(e.target.value)}>
            <option value="all">All Employees</option>
            <option value="unpaid">With Unpaid Balance</option>
            <option value="none">No Balance</option>
          </select>
        </div>

        <div className="lp-table-wrap">
          <table className="lp-table">
            <thead>
              <tr>
                <SortableTh label="Employee ID" column="employeeId" sort={sort} onSort={toggleSort} />
                <SortableTh label="Name" column="name" sort={sort} onSort={toggleSort} />
                <SortableTh label="Total Advanced" column="totalAdvances" sort={sort} onSort={toggleSort} />
                <SortableTh label="Paid via Payroll" column="totalDeductions" sort={sort} onSort={toggleSort} />
                <SortableTh label="Unpaid Balance" column="balance" sort={sort} onSort={toggleSort} />
                <th>Actions</th>
              </tr>
            </thead>

            <tbody ref={tbodyRef}>
              {loading ? (
                <SkeletonRows rows={6} cols={6} />
              ) : sortedRows.length > 0 ? (
                sortedRows.map((emp) => (
                  <tr key={emp._id} data-key={emp._id}>
                    <td>{emp.employeeId}</td>
                    <td>
                      {getEmployeeName(emp)}
                      {!emp.isActive && <span className="lp-muted"> (inactive)</span>}
                    </td>
                    <td>{formatMoney(emp.totalAdvances)}</td>
                    <td>{formatMoney(emp.totalDeductions)}</td>
                    <td>
                      <strong>{formatMoney(emp.balance)}</strong>
                    </td>
                    <td>
                      <div className="lp-btn-row">
                        <button
                          className="lp-btn secondary small"
                          onClick={() => openLedger(emp._id)}
                        >
                          History
                        </button>
                        <button
                          className="lp-btn small"
                          onClick={() => openAddModal(emp._id)}
                        >
                          + Advance
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="lp-empty">
                    No employees found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <div className="lp-modal-overlay">
          <div className="lp-modal">
            <div className="lp-modal-header">
              <div>
                <h2>Record Cash Advance</h2>
                <p>It will be deducted in payroll when you choose to.</p>
              </div>
              <button className="lp-modal-close" onClick={() => setShowAddModal(false)}>
                ×
              </button>
            </div>

            {formError && <div className="lp-alert error">{formError}</div>}

            <form className="lp-form" onSubmit={saveAdvance}>
              <div className="lp-field">
                <label>Employee</label>
                <select
                  value={form.employee}
                  onChange={(e) => setForm({ ...form, employee: e.target.value })}
                  required
                >
                  <option value="">Select employee</option>
                  {summary
                    .filter((emp) => emp.isActive || emp._id === form.employee)
                    .map((emp) => (
                      <option key={emp._id} value={emp._id}>
                        {emp.employeeId} - {getEmployeeName(emp)}
                      </option>
                    ))}
                </select>
              </div>

              <div className="lp-form-grid">
                <div className="lp-field">
                  <label>Amount (₱)</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    required
                  />
                </div>

                <div className="lp-field">
                  <label>Date Given</label>
                  <input
                    type="date"
                    max={todayLocal()}
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="lp-field">
                <label>Note (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Emergency medical expense"
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                />
              </div>

              <div className="lp-modal-actions">
                <button
                  type="button"
                  className="lp-btn secondary"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="lp-btn" disabled={saving}aria-busy={saving}>
                  {saving && <Spinner />}
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {ledger && (
        <div className="lp-modal-overlay">
          <div className="lp-modal wide">
            <div className="lp-modal-header">
              <div>
                <h2>Cash Advance History</h2>
                <p>
                  {ledger.employee.employeeId} · {getEmployeeName(ledger.employee)}
                </p>
              </div>
              <button className="lp-modal-close" onClick={() => setLedger(null)}>
                ×
              </button>
            </div>

            <div className="lp-details">
              <div>
                <span>Total Advanced</span>
                <strong>{formatMoney(ledger.totalAdvances)}</strong>
              </div>
              <div>
                <span>Paid via Payroll</span>
                <strong>{formatMoney(ledger.totalDeductions)}</strong>
              </div>
              <div>
                <span>Unpaid Balance</span>
                <strong>{formatMoney(ledger.balance)}</strong>
              </div>
            </div>

            {ledgerError && <div className="lp-alert error">{ledgerError}</div>}

            <div className="lp-table-wrap">
              <table className="lp-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Details</th>
                    <th>Recorded</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.entries.length > 0 ? (
                    ledger.entries.map((entry) => (
                      <tr key={entry._id}>
                        <td>{entry.date}</td>
                        <td>
                          <span className={`lp-badge ${entry.type}`}>
                            {entry.type === "advance" ? "Advance" : "Payroll deduction"}
                          </span>
                        </td>
                        <td>{formatMoney(entry.amount)}</td>
                        <td>{entry.note || "-"}</td>
                        <td className="lp-muted">
                          {getEmployeeName(entry.createdBy)}, {formatDateTime(entry.createdAt)}
                        </td>
                        <td>
                          {entry.type === "advance" && (
                            <button
                              className="lp-btn secondary small"
                              onClick={() => deleteEntry(entry)}
                            >
                              Delete
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="lp-empty">
                        No cash advances recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="lp-modal-actions">
              <button
                className="lp-btn"
                onClick={() => {
                  const employeeId = ledger.employee._id;
                  setLedger(null);
                  openAddModal(employeeId);
                }}
              >
                + Record Advance
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CashAdvances;
