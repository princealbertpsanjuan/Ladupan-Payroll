import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import StatusBadge from "../../components/StatusBadge";
import Icon from "../../components/Icon";
import { formatMinutes } from "../../utils/format";
import useFlipList from "../../hooks/useFlipList";
import "../../styles/myarchives.css";
import { SkeletonRows } from "../../components/Skeleton";
import TimeOutValue from "../../components/TimeOutValue";

const COLUMN_COUNT = 8;

const formatMoney = (value) => {
  return `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const formatDate = (date) => {
  if (!date) return "-";
  return date.includes("T") ? date.slice(0, 10) : date;
};

// "Nov 12 – Nov 14, 2026"
const formatPeriod = (start, end) => {
  if (!start || !end) return "Unknown payroll period";

  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  const sameYear = startDate.getFullYear() === endDate.getFullYear();

  const startText = startDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  const endText = endDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return `${startText} – ${endText}`;
};

// Archived DTR grouped by payroll period. Each payroll is a folder:
// closed by default, click to open its records.
const MyArchives = () => {
  const tableRef = useRef(null);
  const [records, setRecords] = useState([]);
  const [payslips, setPayslips] = useState({});
  const [loading, setLoading] = useState(true);
  const [openGroups, setOpenGroups] = useState([]);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    fetchArchives();
  }, []);

  const fetchArchives = async () => {
    try {
      setLoading(true);

      const [archiveRes, payslipRes] = await Promise.all([
        api.get("/attendance/my-archives"),
        api.get("/payslips/my").catch(() => ({ data: [] })),
      ]);

      const archiveList = Array.isArray(archiveRes.data)
        ? archiveRes.data
        : archiveRes.data.records || [];

      // Net pay per payroll comes from the employee's own payslips
      const payslipMap = {};
      (Array.isArray(payslipRes.data) ? payslipRes.data : []).forEach((payslip) => {
        payslipMap[payslip.reportId] = payslip;
      });

      setRecords(archiveList);
      setPayslips(payslipMap);
    } catch (error) {
      console.log(error);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  const isFiltering = Boolean(search) || filter !== "All";

  const filteredRecords = records.filter((record) => {
    const keyword = search.toLowerCase();
    const period = `${record.payrollReport?.payrollPeriodStart || ""} ${
      record.payrollReport?.payrollPeriodEnd || ""
    }`;

    const matchesSearch =
      !keyword ||
      record.date?.toLowerCase().includes(keyword) ||
      record.remarks?.toLowerCase().includes(keyword) ||
      period.includes(keyword);

    const matchesFilter = filter === "All" || record.remarks === filter;

    return matchesSearch && matchesFilter;
  });

  // One group per payroll, newest first
  const groups = (() => {
    const map = new Map();

    filteredRecords.forEach((record) => {
      const report = record.payrollReport;
      const id = report?._id || "unknown";

      if (!map.has(id)) {
        map.set(id, {
          id,
          start: report?.payrollPeriodStart,
          end: report?.payrollPeriodEnd,
          records: [],
          totalHours: 0,
          grossPay: 0,
          lateCount: 0,
          absentCount: 0,
        });
      }

      const group = map.get(id);
      group.records.push(record);
      group.totalHours += Number(record.totalHours || 0);
      group.grossPay += Number(record.grossPay || 0);
      if (record.remarks === "Late") group.lateCount++;
      if (record.remarks === "Absent") group.absentCount++;
    });

    return [...map.values()]
      .map((group) => ({
        ...group,
        totalHours: Number(group.totalHours.toFixed(2)),
        records: [...group.records].sort((a, b) => String(a.date).localeCompare(String(b.date))),
      }))
      .sort((a, b) => String(b.end || "").localeCompare(String(a.end || "")));
  })();

  // While searching or filtering, show matching records without clicking
  const isOpen = (id) => isFiltering || openGroups.includes(id);

  const toggleGroup = (id) => {
    setOpenGroups((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  useFlipList(tableRef, `${search}-${filter}-${openGroups.join(",")}`);

  return (
    <div className="myarchives-page">
      <div className="myarchives-header">
        <div>
          <h1>My Archived DTR Records</h1>

          <p>Your attendance records, grouped by the payroll they were paid in.</p>
        </div>
      </div>

      <div className="myarchives-card">
        <div className="myarchives-tools">
          <input
            type="text"
            placeholder="Search by date, remarks, or payroll period..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="All">All Remarks</option>
            <option value="Present">Present</option>
            <option value="Late">Late</option>
            <option value="Absent">Absent</option>
          </select>

          {!isFiltering && groups.length > 1 && (
            <button
              type="button"
              className="lp-btn secondary"
              onClick={() =>
                setOpenGroups(openGroups.length === groups.length ? [] : groups.map((g) => g.id))
              }
            >
              {openGroups.length === groups.length ? "Close all" : "Open all"}
            </button>
          )}
        </div>

        <table ref={tableRef} className="payroll-groups-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Time In</th>
              <th>Time Out</th>
              <th>Total Hours</th>
              <th>Gross Pay</th>
              <th>Late</th>
              <th>Remarks</th>
              <th></th>
            </tr>
          </thead>

          {loading ? (
            <tbody>
              <SkeletonRows rows={4} cols={COLUMN_COUNT} />
            </tbody>
          ) : groups.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={COLUMN_COUNT} className="empty-text">
                  {records.length === 0
                    ? "No archived records yet. Records move here after a payroll that includes them is generated."
                    : "No archived records match your search."}
                </td>
              </tr>
            </tbody>
          ) : (
            groups.map((group) => {
              const open = isOpen(group.id);
              const payslip = payslips[group.id];

              return (
                <tbody key={group.id} className="employee-group">
                  <tr className="group-row" data-key={`group-${group.id}`}>
                    <td colSpan={COLUMN_COUNT}>
                      <div className="group-header">
                        <button
                          type="button"
                          className="group-toggle"
                          aria-expanded={open}
                          onClick={() => toggleGroup(group.id)}
                          disabled={isFiltering}
                        >
                          <Icon name="chevronDown" size={16} className="group-chevron" />
                          <span className="group-avatar period-icon">
                            <Icon name="calendar" size={16} />
                          </span>
                          <span className="group-name">
                            <strong>{formatPeriod(group.start, group.end)}</strong>
                            <span>
                              Payroll period
                              {payslip?.generatedDate &&
                                ` · paid ${new Date(payslip.generatedDate).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })}`}
                            </span>
                          </span>
                        </button>

                        <div className="group-stats">
                          <span>
                            <strong>{group.records.length}</strong> day
                            {group.records.length !== 1 ? "s" : ""}
                          </span>
                          <span>
                            <strong>{group.totalHours}</strong> hrs
                          </span>
                          <span>
                            <strong>{formatMoney(group.grossPay)}</strong> gross
                          </span>
                          {payslip && !isFiltering && (
                            <span>
                              <strong>{formatMoney(payslip.netSalary)}</strong> net
                            </span>
                          )}
                          {group.lateCount > 0 && (
                            <span className="status late">{group.lateCount} late</span>
                          )}
                          {group.absentCount > 0 && (
                            <span className="status absent">{group.absentCount} absent</span>
                          )}
                          {payslip && (
                            <Link className="lp-btn secondary small" to={`/client/payslips/${group.id}`}>
                              Payslip
                            </Link>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>

                  {open &&
                    group.records.map((record) => (
                      <tr key={record._id} data-key={record._id}>
                        <td>{formatDate(record.date)}</td>
                        <td>
                          {record.timeIn || "-"}
                          <div className="lp-muted">Required {record.requiredTimeIn || "-"}</div>
                        </td>
                        <td>
                          <TimeOutValue record={record} />
                        </td>
                        <td>{record.totalHours || 0}</td>
                        <td>{formatMoney(record.grossPay)}</td>
                        <td>{formatMinutes(record.lateMinutes)}</td>
                        <td>
                          <StatusBadge record={record} />
                        </td>
                        <td></td>
                      </tr>
                    ))}
                </tbody>
              );
            })
          )}
        </table>

        <div className="myarchives-footer">
          {groups.length} payroll period{groups.length !== 1 ? "s" : ""} · {filteredRecords.length}{" "}
          archived record{filteredRecords.length !== 1 ? "s" : ""}
          {isFiltering && " (matching your search, shown open)"}
        </div>
      </div>
    </div>
  );
};

export default MyArchives;
