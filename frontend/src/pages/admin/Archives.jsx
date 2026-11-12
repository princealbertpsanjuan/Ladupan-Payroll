import { useEffect, useRef, useState } from "react";
import api from "../../api/axios";
import StatusBadge from "../../components/StatusBadge";
import Icon from "../../components/Icon";
import { formatMinutes } from "../../utils/format";
import useFlipList from "../../hooks/useFlipList";
import "../../styles/archives.css";
import { SkeletonRows } from "../../components/Skeleton";

const VIEW_STORAGE_KEY = "lp-archives-view";

const getEmployeeName = (employee) => {
  if (!employee) return "Deleted employee";

  return `${employee.firstName || ""} ${employee.lastName || ""}`.trim();
};

const getInitials = (employee) => {
  const name = getEmployeeName(employee);
  const parts = name.split(" ").filter(Boolean);
  return `${parts[0]?.[0] || ""}${parts.length > 1 ? parts[parts.length - 1][0] : ""}`.toUpperCase() || "?";
};

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

const periodOf = (record) =>
  record.payrollReport
    ? `${record.payrollReport.payrollPeriodStart} to ${record.payrollReport.payrollPeriodEnd}`
    : "-";

const Archives = () => {
  const tableRef = useRef(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [collapsedGroups, setCollapsedGroups] = useState([]);

  // "employee" = grouped by employee (default), "list" = all records
  const [viewMode, setViewMode] = useState(() => {
    try {
      return localStorage.getItem(VIEW_STORAGE_KEY) || "employee";
    } catch {
      return "employee";
    }
  });

  useEffect(() => {
    fetchArchives();
  }, []);

  const fetchArchives = async () => {
    try {
      setLoading(true);

      const res = await api.get("/reports/archives");

      const archiveList = Array.isArray(res.data)
        ? res.data
        : res.data.records || res.data.data || [];

      setRecords(archiveList);
    } catch (error) {
      console.error("Error fetching archives:", error);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  const changeViewMode = (mode) => {
    setViewMode(mode);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, mode);
    } catch {
      // storage unavailable
    }
  };

  const years = [
    "All",
    ...new Set(
      records
        .map((record) => new Date(record.createdAt).getFullYear().toString())
        .filter((year) => year !== "NaN")
    ),
  ];

  const filteredRecords = records.filter((record) => {
    const keyword = search.toLowerCase();
    const employee = getEmployeeName(record.employee).toLowerCase();
    const code = (record.employee?.employeeId || "").toLowerCase();
    const payrollPeriod = periodOf(record).toLowerCase();

    const matchesSearch =
      employee.includes(keyword) || code.includes(keyword) || payrollPeriod.includes(keyword);

    const recordYear = new Date(record.createdAt).getFullYear().toString();
    const matchesFilter = filter === "All" || recordYear === filter;

    return matchesSearch && matchesFilter;
  });

  // Group by employee (alphabetical); totals use only the shown records
  const groups = (() => {
    const map = new Map();

    filteredRecords.forEach((record) => {
      const id = record.employee?._id || "unknown";

      if (!map.has(id)) {
        map.set(id, {
          id,
          employee: record.employee,
          records: [],
          totalHours: 0,
          grossPay: 0,
          periods: new Set(),
        });
      }

      const group = map.get(id);
      group.records.push(record);
      group.totalHours += Number(record.totalHours || 0);
      group.grossPay += Number(record.grossPay || 0);
      if (record.payrollReport) group.periods.add(record.payrollReport._id || periodOf(record));
    });

    return [...map.values()]
      .map((group) => ({ ...group, totalHours: Number(group.totalHours.toFixed(2)) }))
      .sort((a, b) => getEmployeeName(a.employee).localeCompare(getEmployeeName(b.employee)));
  })();

  const columnCount = viewMode === "list" ? 9 : 8;

  const toggleGroup = (id) => {
    setCollapsedGroups((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  useFlipList(tableRef, `${viewMode}-${search}-${filter}-${collapsedGroups.join(",")}`);

  const renderRecordRow = (record, showEmployee) => (
    <tr key={record._id} data-key={record._id}>
      {showEmployee && (
        <td>
          {getEmployeeName(record.employee)}
          {record.employee?.employeeId && (
            <div className="lp-muted">{record.employee.employeeId}</div>
          )}
        </td>
      )}
      <td>{formatDate(record.date)}</td>
      <td>
        {record.timeIn || "-"}
        {record.requiredTimeIn && <div className="lp-muted">Required {record.requiredTimeIn}</div>}
      </td>
      <td>{record.timeOut || "-"}</td>
      <td>{record.totalHours || 0}</td>
      <td>{formatMoney(record.grossPay)}</td>
      <td>{formatMinutes(record.lateMinutes)}</td>
      <td>
        <StatusBadge record={record} />
      </td>
      <td className="lp-nowrap">{periodOf(record)}</td>
    </tr>
  );

  return (
    <div className="archives-page">
      <div className="archives-header">
        <div>
          <h1>Archived Attendance Records</h1>

          <p>View archived payroll attendance records and generated payroll periods.</p>
        </div>
      </div>

      <div className="archives-card">
        <div className="archives-tools">
          <input
            type="text"
            placeholder="Search employee, ID, or payroll period..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            {years.map((year) => (
              <option key={year} value={year}>
                {year === "All" ? "All Years" : year}
              </option>
            ))}
          </select>

          <div className="view-switch" role="group" aria-label="View">
            <button
              type="button"
              className={viewMode === "employee" ? "active" : ""}
              aria-pressed={viewMode === "employee"}
              onClick={() => changeViewMode("employee")}
            >
              By employee
            </button>
            <button
              type="button"
              className={viewMode === "list" ? "active" : ""}
              aria-pressed={viewMode === "list"}
              onClick={() => changeViewMode("list")}
            >
              All records
            </button>
          </div>
        </div>

        <table ref={tableRef}>
          <thead>
            <tr>
              {viewMode === "list" && <th>Employee</th>}
              <th>Date</th>
              <th>Time In</th>
              <th>Time Out</th>
              <th>Total Hours</th>
              <th>Gross Pay</th>
              <th>Late</th>
              <th>Remarks</th>
              <th>Payroll Period</th>
            </tr>
          </thead>

          {loading ? (
            <tbody>
              <SkeletonRows rows={6} cols={columnCount} />
            </tbody>
          ) : filteredRecords.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={columnCount} className="empty-text">
                  No archived attendance records found.
                </td>
              </tr>
            </tbody>
          ) : viewMode === "list" ? (
            <tbody>{filteredRecords.map((record) => renderRecordRow(record, true))}</tbody>
          ) : (
            groups.map((group) => {
              const isCollapsed = collapsedGroups.includes(group.id);

              return (
                <tbody key={group.id} className="employee-group">
                  <tr className="group-row" data-key={`group-${group.id}`}>
                    <td colSpan={columnCount}>
                      <div className="group-header">
                        <button
                          type="button"
                          className="group-toggle"
                          aria-expanded={!isCollapsed}
                          onClick={() => toggleGroup(group.id)}
                        >
                          <Icon name="chevronDown" size={16} className="group-chevron" />
                          <span className="group-avatar">{getInitials(group.employee)}</span>
                          <span className="group-name">
                            <strong>
                              {getEmployeeName(group.employee)}
                              {group.employee?.isDeleted && (
                                <span className="deleted-tag">deleted</span>
                              )}
                            </strong>
                            <span>{group.employee?.employeeId || "No Employee ID"}</span>
                          </span>
                        </button>

                        <div className="group-stats">
                          <span>
                            <strong>{group.records.length}</strong> record
                            {group.records.length !== 1 ? "s" : ""}
                          </span>
                          <span>
                            <strong>{group.periods.size}</strong> payroll
                            {group.periods.size !== 1 ? "s" : ""}
                          </span>
                          <span>
                            <strong>{group.totalHours}</strong> hrs
                          </span>
                          <span>
                            <strong>{formatMoney(group.grossPay)}</strong> gross
                          </span>
                        </div>
                      </div>
                    </td>
                  </tr>

                  {!isCollapsed && group.records.map((record) => renderRecordRow(record, false))}
                </tbody>
              );
            })
          )}
        </table>

        <div className="archives-footer">
          Showing {filteredRecords.length} archived attendance record
          {filteredRecords.length !== 1 ? "s" : ""}
          {viewMode === "employee" && filteredRecords.length > 0 && (
            <>
              {" "}
              · {groups.length} employee{groups.length !== 1 ? "s" : ""}
              {groups.length > 1 && (
                <>
                  {" · "}
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() =>
                      setCollapsedGroups(
                        collapsedGroups.length === groups.length ? [] : groups.map((g) => g.id)
                      )
                    }
                  >
                    {collapsedGroups.length === groups.length ? "Expand all" : "Collapse all"}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Archives;
