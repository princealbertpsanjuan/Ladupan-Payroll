import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import { useToast } from "../../context/ToastContext";
import Spinner from "../../components/Spinner";
import { formatMoney, formatMinutes } from "../../utils/format";
import "../../styles/payroll.css";

const roundMoney = (value) => Math.round(Number(value || 0) * 100) / 100;

const Payroll = () => {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");

  const [preview, setPreview] = useState(null);
  const [deductions, setDeductions] = useState({});
  const [includeIncomplete, setIncludeIncomplete] = useState(false);

  const toast = useToast();

  // Results and errors are shown as toasts
  const setMessage = ({ type, text, title }) => {
    if (text) toast[type](text, title ? { title } : undefined);
  };
  const [report, setReport] = useState(null);
  const [skipped, setSkipped] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState("");

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const res = await api.get("/employees");
      const employeeList = Array.isArray(res.data) ? res.data : [];

      // Inactive employees stay selectable so their remaining DTR days can
      // still be paid (final pay); active employees are listed first
      setEmployees(
        [...employeeList].sort((a, b) => Number(b.isActive) - Number(a.isActive))
      );
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  const getEmployeeName = (emp) => `${emp.firstName || ""} ${emp.lastName || ""}`.trim();

  // Any change to the period or selection makes the preview outdated
  const resetPreview = () => {
    setPreview(null);
    setDeductions({});
    setIncludeIncomplete(false);
  };

  const handleSelectEmployee = (id) => {
    resetPreview();

    if (selectedEmployees.includes(id)) {
      setSelectedEmployees(selectedEmployees.filter((empId) => empId !== id));
    } else {
      setSelectedEmployees([...selectedEmployees, id]);
    }
  };

  // Select All picks active employees only; inactive employees can be
  // ticked one by one when they still have unpaid DTR days
  const activeIds = employees.filter((emp) => emp.isActive).map((emp) => emp._id);
  const allActiveSelected =
    activeIds.length > 0 && activeIds.every((id) => selectedEmployees.includes(id));

  const handleSelectAll = () => {
    resetPreview();

    if (allActiveSelected) {
      setSelectedEmployees([]);
    } else {
      setSelectedEmployees(activeIds);
    }
  };

  const previewPayroll = async (e) => {
    e.preventDefault();
    setReport(null);
    setSkipped([]);

    if (selectedEmployees.length === 0) {
      setMessage({ type: "error", text: "Please select at least one employee." });
      return;
    }

    try {
      setLoading(true);
      setBusyAction("preview");

      const res = await api.post("/payroll/preview", {
        startDate,
        endDate,
        employeeIds: selectedEmployees,
      });

      const initialDeductions = {};
      res.data.employees.forEach((emp) => {
        initialDeductions[emp.employee] = {
          cashAdvance: "",
          otherDeductions: "",
          otherDeductionsNote: "",
        };
      });

      setPreview(res.data);
      setDeductions(initialDeductions);
      setIncludeIncomplete(false);

      if (res.data.employees.length === 0) {
        setMessage({
          type: "error",
          text: "None of the selected employees have active DTR records in this period.",
        });
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.message || "Payroll preview failed.",
      });
    } finally {
      setLoading(false);
      setBusyAction("");
    }
  };

  const updateDeduction = (employeeId, field, value) => {
    setDeductions({
      ...deductions,
      [employeeId]: {
        ...deductions[employeeId],
        [field]: value,
      },
    });
  };

  const getNet = (row) => {
    const input = deductions[row.employee] || {};
    return roundMoney(
      row.grossSalary -
        (row.lateDeductions || 0) -
        Number(input.cashAdvance || 0) -
        Number(input.otherDeductions || 0)
    );
  };

  const getRowError = (row) => {
    const input = deductions[row.employee] || {};
    const cashAdvance = Number(input.cashAdvance || 0);
    const other = Number(input.otherDeductions || 0);

    if (cashAdvance < 0 || other < 0) return "Deductions cannot be negative";
    if (cashAdvance > row.cashAdvanceBalance) {
      return `More than unpaid balance (${formatMoney(row.cashAdvanceBalance)})`;
    }
    if (getNet(row) < 0) return "Deductions are more than gross pay";
    return "";
  };

  const hasIncomplete = preview?.incompleteRecords?.length > 0;
  const hasRowErrors = preview?.employees?.some((row) => getRowError(row));

  const generatePayroll = async () => {
    try {
      setLoading(true);
      setBusyAction("generate");

      const res = await api.post("/payroll/generate", {
        startDate,
        endDate,
        employeeIds: selectedEmployees,
        includeIncomplete,
        deductions: preview.employees.map((row) => ({
          employee: row.employee,
          cashAdvance: Number(deductions[row.employee]?.cashAdvance || 0),
          otherDeductions: Number(deductions[row.employee]?.otherDeductions || 0),
          otherDeductionsNote: deductions[row.employee]?.otherDeductionsNote || "",
        })),
      });

      setMessage({
        type: "success",
        title: "Payroll generated",
        text: `${res.data.payrollReport?.totalEmployees || 0} employee(s) paid. Their DTR records were moved to Archives and payslips are ready.`,
      });
      setReport(res.data.payrollReport);
      setSkipped(res.data.skipped || []);
      setSelectedEmployees([]);
      resetPreview();
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.message || "Payroll generation failed.",
      });

      // New incomplete records were found since the preview
      if (error.response?.status === 409 && preview) {
        setPreview({
          ...preview,
          incompleteRecords: error.response.data.incompleteRecords || [],
        });
      }
    } finally {
      setLoading(false);
      setBusyAction("");
    }
  };

  const visibleEmployees = employees.filter((emp) => {
    const keyword = employeeSearch.toLowerCase();
    return (
      !keyword ||
      getEmployeeName(emp).toLowerCase().includes(keyword) ||
      emp.employeeId?.toLowerCase().includes(keyword)
    );
  });

  return (
    <div className="payroll-page">
      <div className="payroll-header">
        <div>
          <h1>Payroll Generation</h1>
          <p>Generate payroll by date period and selected employees only.</p>
        </div>
      </div>

      <div className="payroll-card">
        <form onSubmit={previewPayroll}>
          <div className="payroll-form-grid">
            <div className="form-group">
              <label>Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  resetPreview();
                  setStartDate(e.target.value);
                }}
                required
              />
            </div>

            <div className="form-group">
              <label>End Date</label>
              <input
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => {
                  resetPreview();
                  setEndDate(e.target.value);
                }}
                required
              />
            </div>
          </div>

          <div className="employee-select-header">
            <h3>
              Select Employees ({selectedEmployees.length} of {employees.length})
            </h3>

            <button type="button" className="select-all-btn" onClick={handleSelectAll}>
              {allActiveSelected ? "Unselect All" : "Select All Active"}
            </button>
          </div>

          {employees.length > 6 && (
            <div className="lp-toolbar">
              <input
                type="text"
                placeholder="Search employee by name or ID..."
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
              />
            </div>
          )}

          <div className="employee-list">
            {visibleEmployees.length > 0 ? (
              visibleEmployees.map((emp) => (
                <label key={emp._id} className="employee-check-card">
                  <input
                    type="checkbox"
                    checked={selectedEmployees.includes(emp._id)}
                    onChange={() => handleSelectEmployee(emp._id)}
                  />

                  <div>
                    <strong>
                      {getEmployeeName(emp)}
                      {!emp.isActive && <span className="lp-muted"> (inactive)</span>}
                    </strong>
                    <span>
                      {emp.employeeId} | Rate: ₱{Number(emp.hourlyRate || 0).toFixed(2)} |
                      Required In: {emp.requiredTimeIn || "-"}
                    </span>
                  </div>
                </label>
              ))
            ) : (
              <p className="empty-text">No employees found.</p>
            )}
          </div>

          <button
            type="submit"
            className="generate-btn"
            disabled={loading}
            aria-busy={busyAction === "preview"}
          >
            {busyAction === "preview" && <Spinner />}
            {busyAction === "preview" ? "Calculating..." : "Preview Payroll"}
          </button>
        </form>
      </div>

      {preview && preview.employees.length > 0 && (
        <div className="payroll-card report-card lp-reveal">
          <h2>
            Payroll Preview: {preview.startDate} to {preview.endDate}
          </h2>

          <p className="lp-card-subtitle">
            Review hours and gross pay, then enter any cash advance or other
            deductions. Nothing is saved until you click Generate Payroll.
          </p>

          {hasIncomplete && (
            <div className="lp-alert warning">
              <strong>
                {preview.incompleteRecords.length} DTR record(s) have no time-out
              </strong>{" "}
              and will count as 0 hours:
              <ul>
                {preview.incompleteRecords.map((record) => (
                  <li key={record._id}>
                    {record.employeeName}: {record.date} (timed in {record.timeIn})
                  </li>
                ))}
              </ul>
              <p style={{ marginTop: 8 }}>
                Set their time-out in{" "}
                <Link to="/admin/attendance?filter=incomplete">Attendance Management</Link>{" "}
                first, then preview again. Or include them as 0 hours:
              </p>
              <label className="lp-check">
                <input
                  type="checkbox"
                  checked={includeIncomplete}
                  onChange={(e) => setIncludeIncomplete(e.target.checked)}
                />
                Include these records as 0 hours
              </label>
            </div>
          )}

          {preview.skipped.length > 0 && (
            <div className="lp-alert info">
              Not included (no active DTR records in this period):{" "}
              {preview.skipped.map((item) => item.employeeName).join(", ")}
            </div>
          )}

          <div className="lp-table-wrap">
            <table className="lp-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Present</th>
                  <th>Late</th>
                  <th>Absent</th>
                  <th>Total Late</th>
                  <th>Total Hours</th>
                  <th>Gross Salary</th>
                  <th>Cash Advance</th>
                  <th>Other Deductions</th>
                  <th>Note</th>
                  <th>Net Salary</th>
                </tr>
              </thead>

              <tbody>
                {preview.employees.map((row) => {
                  const rowError = getRowError(row);

                  return (
                    <tr key={row.employee}>
                      <td>
                        <strong>{row.employeeName}</strong>
                        <div className="lp-muted">
                          {row.employeeCode} · {row.recordCount} DTR record(s)
                          {row.totalIncomplete > 0 &&
                            ` · ${row.totalIncomplete} without time-out`}
                        </div>
                      </td>
                      <td>{row.totalPresent}</td>
                      <td>{row.totalLate}</td>
                      <td>{row.totalAbsent}</td>
                      <td className="lp-nowrap">{formatMinutes(row.totalLateMinutes)}</td>
                      <td>{row.totalHours}</td>
                      <td className="lp-nowrap">{formatMoney(row.grossSalary)}</td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          disabled={row.cashAdvanceBalance <= 0}
                          value={deductions[row.employee]?.cashAdvance ?? ""}
                          onChange={(e) =>
                            updateDeduction(row.employee, "cashAdvance", e.target.value)
                          }
                        />
                        <div className="lp-muted lp-nowrap">
                          Balance: {formatMoney(row.cashAdvanceBalance)}
                          {row.cashAdvanceBalance > 0 && (
                            <>
                              {" "}
                              <button
                                type="button"
                                className="lp-btn secondary small"
                                style={{ padding: "2px 8px", marginTop: 4 }}
                                onClick={() =>
                                  updateDeduction(
                                    row.employee,
                                    "cashAdvance",
                                    String(Math.min(row.cashAdvanceBalance, row.grossSalary))
                                  )
                                }
                              >
                                Max
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={deductions[row.employee]?.otherDeductions ?? ""}
                          onChange={(e) =>
                            updateDeduction(row.employee, "otherDeductions", e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="wide"
                          placeholder="e.g. uniform"
                          value={deductions[row.employee]?.otherDeductionsNote ?? ""}
                          onChange={(e) =>
                            updateDeduction(row.employee, "otherDeductionsNote", e.target.value)
                          }
                        />
                      </td>
                      <td className="lp-nowrap">
                        <strong>{formatMoney(getNet(row))}</strong>
                        {rowError && (
                          <div style={{ color: "#dc2626", fontSize: 12 }}>{rowError}</div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              <tfoot>
                <tr>
                  <td colSpan="6">Total ({preview.employees.length} employees)</td>
                  <td className="lp-nowrap">
                    {formatMoney(
                      preview.employees.reduce((sum, row) => sum + row.grossSalary, 0)
                    )}
                  </td>
                  <td colSpan="3"></td>
                  <td className="lp-nowrap">
                    {formatMoney(preview.employees.reduce((sum, row) => sum + getNet(row), 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="lp-btn-row" style={{ marginTop: 20 }}>
            <button
              type="button"
              className="generate-btn"
              style={{ marginTop: 0 }}
              onClick={generatePayroll}
              disabled={loading || hasRowErrors || (hasIncomplete && !includeIncomplete)}
              aria-busy={busyAction === "generate"}
            >
              {busyAction === "generate" && <Spinner />}
              {busyAction === "generate" ? "Generating Payroll..." : "Generate Payroll"}
            </button>

            <button type="button" className="lp-btn secondary" onClick={resetPreview}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {report && (
        <div className="payroll-card report-card lp-reveal">
          <h2>Generated Payroll Report</h2>

          <div className="report-summary">
            <p>
              <strong>Payroll Period:</strong> {report.payrollPeriodStart} to{" "}
              {report.payrollPeriodEnd}
            </p>

            <p>
              <strong>Total Employees:</strong>{" "}
              {report.totalEmployees || report.employees?.length || 0}
            </p>

            <p>
              <strong>Total Net:</strong> {formatMoney(report.totalNet)}
            </p>
          </div>

          {skipped.length > 0 && (
            <div className="lp-alert info">
              Not included (no active DTR records):{" "}
              {skipped.map((item) => item.employeeName).join(", ")}
            </div>
          )}

          <div className="report-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Present</th>
                  <th>Late</th>
                  <th>Absent</th>
                  <th>Total Hours</th>
                  <th>Gross Salary</th>
                  <th>Cash Advance</th>
                  <th>Other Deductions</th>
                  <th>Net Salary</th>
                  <th>Payslip</th>
                </tr>
              </thead>

              <tbody>
                {report.employees?.map((emp) => (
                  <tr key={emp.employee}>
                    <td>{emp.employeeName}</td>
                    <td>{emp.totalPresent || 0}</td>
                    <td>{emp.totalLate || 0}</td>
                    <td>{emp.totalAbsent || 0}</td>
                    <td>{emp.totalHours || 0}</td>
                    <td>{formatMoney(emp.grossSalary)}</td>
                    <td>{formatMoney(emp.cashAdvance)}</td>
                    <td>{formatMoney(emp.otherDeductions)}</td>
                    <td>
                      <strong>{formatMoney(emp.netSalary)}</strong>
                    </td>
                    <td>
                      <Link
                        className="lp-btn small"
                        to={`/admin/payslip/${report._id}/${emp.employee}`}
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Payroll;
