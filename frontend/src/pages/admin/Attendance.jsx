import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../api/axios";
import { useToast } from "../../context/ToastContext";
import { SkeletonRows } from "../../components/Skeleton";
import Spinner from "../../components/Spinner";
import SortableTh from "../../components/SortableTh";
import useSort from "../../hooks/useSort";
import useFlipList from "../../hooks/useFlipList";
import StatusBadge from "../../components/StatusBadge";
import Icon from "../../components/Icon";
import {
  formatMoney,
  formatDate,
  formatMinutes,
  getEmployeeName,
  isIncompleteRecord,
} from "../../utils/format";
import "../../styles/attendance.css";

const emptyForm = {
  employee: "",
  date: "",
  timeIn: "",
  timeOut: "",
};

const VIEW_STORAGE_KEY = "lp-attendance-view";

const getInitials = (employee) =>
  `${employee?.firstName?.[0] || ""}${employee?.lastName?.[0] || ""}`.toUpperCase() || "?";

const SORT_ACCESSORS = {
  employee: (record) => getEmployeeName(record.employee).toLowerCase(),
  date: (record) => formatDate(record.date),
  timeIn: (record) => record.timeIn || "",
  totalHours: (record) => Number(record.totalHours || 0),
  grossPay: (record) => Number(record.grossPay || 0),
  late: (record) => Number(record.lateMinutes || 0),
  remarks: (record) => (isIncompleteRecord(record) ? "Incomplete" : record.remarks || ""),
};

const Attendance = () => {
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const tableRef = useRef(null);

  // "employee" = grouped by employee (default), "list" = all records
  const [viewMode, setViewMode] = useState(() => {
    try {
      return localStorage.getItem(VIEW_STORAGE_KEY) || "employee";
    } catch {
      return "employee";
    }
  });
  const [collapsedGroups, setCollapsedGroups] = useState([]);

  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [deleteRecord, setDeleteRecord] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [deleteError, setDeleteError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(
    searchParams.get("filter") === "incomplete" ? "Incomplete" : "All"
  );
  const [dateFilter, setDateFilter] = useState("");

  useEffect(() => {
    fetchEmployees();
    fetchAttendance();
  }, []);

  const fetchEmployees = async () => {
    try {
      const res = await api.get("/employees");
      const employeeList = Array.isArray(res.data) ? res.data : [];
      setEmployees(employeeList.filter((emp) => emp.isActive));
    } catch (err) {
      console.error("Error fetching employees:", err);
    }
  };

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      const res = await api.get("/attendance");
      setRecords(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching attendance:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const openAddModal = () => {
    setEditingRecord(null);
    setFormData(emptyForm);
    setFormError("");
    setShowModal(true);
  };

  const openEditModal = (record) => {
    setEditingRecord(record);
    setFormData({
      employee: record.employee?._id || record.employee || "",
      date: formatDate(record.date),
      timeIn: record.timeIn || "",
      timeOut: record.timeOut || "",
    });
    setFormError("");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingRecord(null);
    setFormError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    // Required time-in and hourly rate are taken from the employee's
    // settings by the backend
    const payload = {
      employee: formData.employee,
      date: formData.date,
      timeIn: formData.timeIn,
      timeOut: formData.timeOut,
    };

    try {
      setSaving(true);

      if (editingRecord) {
        await api.put(`/attendance/${editingRecord._id}`, payload);
        toast.success("Attendance record updated.");
      } else {
        await api.post("/attendance", payload);
        toast.success("Attendance record added.");
      }

      closeModal();
      fetchAttendance();
    } catch (err) {
      setFormError(err.response?.data?.message || "Failed to save attendance record.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    try {
      setDeleting(true);
      await api.delete(`/attendance/${deleteRecord._id}`);
      setDeleteRecord(null);
      setDeleteError("");
      toast.success("Attendance record deleted.");
      fetchAttendance();
    } catch (err) {
      setDeleteError(err.response?.data?.message || "Failed to delete attendance record.");
    } finally {
      setDeleting(false);
    }
  };

  const incompleteCount = records.filter(isIncompleteRecord).length;

  const filteredRecords = records.filter((record) => {
    const keyword = search.toLowerCase();
    const name = getEmployeeName(record.employee).toLowerCase();
    const code = (record.employee?.employeeId || "").toLowerCase();

    const matchesSearch = !keyword || name.includes(keyword) || code.includes(keyword);

    const matchesStatus =
      statusFilter === "All" ||
      (statusFilter === "Incomplete" && isIncompleteRecord(record)) ||
      record.remarks === statusFilter;

    const matchesDate = !dateFilter || formatDate(record.date) === dateFilter;

    return matchesSearch && matchesStatus && matchesDate;
  });

  const { sortedRows, sort, toggleSort } = useSort(filteredRecords, SORT_ACCESSORS);

  // Group records by employee (alphabetical). Each group keeps the
  // current sort order inside it, and totals use only the shown records.
  const groups = (() => {
    const map = new Map();

    sortedRows.forEach((record) => {
      const id = record.employee?._id || "deleted";

      if (!map.has(id)) {
        map.set(id, {
          id,
          employee: record.employee,
          records: [],
          totalHours: 0,
          grossPay: 0,
          lateCount: 0,
          incompleteCount: 0,
        });
      }

      const group = map.get(id);
      group.records.push(record);
      group.totalHours += Number(record.totalHours || 0);
      group.grossPay += Number(record.grossPay || 0);
      if (record.remarks === "Late") group.lateCount++;
      if (isIncompleteRecord(record)) group.incompleteCount++;
    });

    const list = [...map.values()].map((group) => ({
      ...group,
      totalHours: Number(group.totalHours.toFixed(2)),
    }));

    list.sort((a, b) =>
      getEmployeeName(a.employee).localeCompare(getEmployeeName(b.employee))
    );

    if (sort.key === "employee" && sort.direction === "desc") list.reverse();

    return list;
  })();

  const columnCount = viewMode === "list" ? 9 : 8;

  const toggleGroup = (id) => {
    setCollapsedGroups((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const changeViewMode = (mode) => {
    setViewMode(mode);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, mode);
    } catch {
      // storage unavailable
    }
  };

  useFlipList(
    tableRef,
    `${viewMode}-${sort.key}-${sort.direction}-${search}-${statusFilter}-${dateFilter}-${collapsedGroups.join(",")}`
  );

  const renderRecordRow = (record, showEmployee) => (
    <tr key={record._id} data-key={record._id}>
      {showEmployee && (
        <td>
          {getEmployeeName(record.employee)}
          <div className="lp-muted">{record.employee?.employeeId}</div>
        </td>
      )}
      <td>{formatDate(record.date)}</td>
      <td>
        {record.timeIn || "-"}
        <div className="lp-muted">Required {record.requiredTimeIn || "-"}</div>
      </td>
      <td>{record.timeOut || "-"}</td>
      <td>{record.totalHours || 0}</td>
      <td>
        {formatMoney(record.grossPay)}
        <div className="lp-muted">@ {formatMoney(record.hourlyRate)}/hr</div>
      </td>
      <td>{formatMinutes(record.lateMinutes)}</td>
      <td>
        <StatusBadge record={record} />
      </td>
      <td className="action-buttons">
        <button className="edit-btn" onClick={() => openEditModal(record)}>
          {isIncompleteRecord(record) ? "Set Time Out" : "Edit"}
        </button>

        <button
          className="delete-btn"
          onClick={() => {
            setDeleteError("");
            setDeleteRecord(record);
          }}
        >
          Delete
        </button>
      </td>
    </tr>
  );

  return (
    <div className="attendance-page">
      <div className="attendance-header">
        <div>
          <h1>Attendance Management</h1>
          <p>Manage employee daily time records and attendance status.</p>
        </div>

        <button className="add-btn" onClick={openAddModal}>
          + Add Attendance
        </button>
      </div>

      {incompleteCount > 0 && (
        <div className="lp-alert warning">
          {incompleteCount} record(s) have no time-out. Use <strong>Set Time Out</strong>{" "}
          to complete them. Until then they count as 0 hours in payroll.{" "}
          <button
            className="lp-btn secondary small"
            onClick={() => setStatusFilter("Incomplete")}
          >
            Show them
          </button>
        </div>
      )}

      <div className="attendance-card">
        <div className="lp-toolbar">
          <input
            type="text"
            placeholder="Search by employee name or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All">All Remarks</option>
            <option value="Present">Present</option>
            <option value="Late">Late</option>
            <option value="Absent">Absent</option>
            <option value="Incomplete">No time-out</option>
          </select>

          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />

          <button
            className="lp-btn secondary"
            onClick={() => {
              setSearch("");
              setStatusFilter("All");
              setDateFilter("");
            }}
          >
            Reset
          </button>

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

        <table ref={tableRef} className="attendance-table">
          <thead>
            <tr>
              {viewMode === "list" && (
                <SortableTh label="Employee" column="employee" sort={sort} onSort={toggleSort} />
              )}
              <SortableTh label="Date" column="date" sort={sort} onSort={toggleSort} />
              <SortableTh label="Time In" column="timeIn" sort={sort} onSort={toggleSort} />
              <th>Time Out</th>
              <SortableTh label="Total Hours" column="totalHours" sort={sort} onSort={toggleSort} />
              <SortableTh label="Gross Pay" column="grossPay" sort={sort} onSort={toggleSort} />
              <SortableTh label="Late" column="late" sort={sort} onSort={toggleSort} />
              <SortableTh label="Remarks" column="remarks" sort={sort} onSort={toggleSort} />
              <th>Action</th>
            </tr>
          </thead>

          {loading && records.length === 0 ? (
            <tbody>
              <SkeletonRows rows={6} cols={columnCount} />
            </tbody>
          ) : sortedRows.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={columnCount} className="empty-text">
                  No attendance records found.
                </td>
              </tr>
            </tbody>
          ) : viewMode === "list" ? (
            <tbody>{sortedRows.map((record) => renderRecordRow(record, true))}</tbody>
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
                            <strong>{getEmployeeName(group.employee)}</strong>
                            <span>
                              {group.employee?.employeeId || "-"}
                              {group.employee?.hourlyRate !== undefined &&
                                ` · ${formatMoney(group.employee.hourlyRate)}/hr`}
                              {group.employee?.requiredTimeIn &&
                                ` · Required ${group.employee.requiredTimeIn}`}
                            </span>
                          </span>
                        </button>

                        <div className="group-stats">
                          <span>
                            <strong>{group.records.length}</strong> record
                            {group.records.length !== 1 ? "s" : ""}
                          </span>
                          <span>
                            <strong>{group.totalHours}</strong> hrs
                          </span>
                          <span>
                            <strong>{formatMoney(group.grossPay)}</strong> gross
                          </span>
                          {group.lateCount > 0 && (
                            <span className="status late">{group.lateCount} late</span>
                          )}
                          {group.incompleteCount > 0 && (
                            <span className="status incomplete">
                              {group.incompleteCount} no time-out
                            </span>
                          )}
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

        <div className="attendance-footer">
          Showing {filteredRecords.length} of {records.length} active DTR record
          {records.length !== 1 ? "s" : ""}
          {viewMode === "employee" && sortedRows.length > 0 && (
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

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h2>{editingRecord ? "Edit Attendance" : "Add Attendance"}</h2>

            {formError && <div className="lp-alert error">{formError}</div>}

            <form onSubmit={handleSubmit}>
              <label>Employee</label>
              {editingRecord ? (
                <input value={getEmployeeName(editingRecord.employee)} disabled />
              ) : (
                <select
                  name="employee"
                  value={formData.employee}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select employee</option>

                  {employees.map((emp) => (
                    <option key={emp._id} value={emp._id}>
                      {emp.employeeId} - {getEmployeeName(emp)}
                    </option>
                  ))}
                </select>
              )}

              <label>Date</label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                required
              />

              <label>Time In</label>
              <input
                type="time"
                name="timeIn"
                value={formData.timeIn}
                onChange={handleChange}
                required
              />

              <label>Time Out</label>
              <input
                type="time"
                name="timeOut"
                value={formData.timeOut}
                onChange={handleChange}
              />

              <p className="lp-muted">
                Remarks, hours, and pay are calculated automatically from the
                employee's required time-in and hourly rate.
              </p>

              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={closeModal}>
                  Cancel
                </button>

                <button type="submit" className="save-btn" disabled={saving} aria-busy={saving}>
                  {saving && <Spinner />}
                  {saving ? "Saving..." : editingRecord ? "Update" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteRecord && (
        <div className="modal-overlay">
          <div className="delete-box">
            <h2>Delete Attendance?</h2>

            <p>
              Are you sure you want to delete the DTR of{" "}
              <strong>{getEmployeeName(deleteRecord.employee)}</strong> on{" "}
              <strong>{formatDate(deleteRecord.date)}</strong>? This action
              cannot be undone.
            </p>

            {deleteError && <div className="lp-alert error">{deleteError}</div>}

            <div className="modal-actions">
              <button className="cancel-btn" onClick={() => setDeleteRecord(null)}>
                Cancel
              </button>

              <button
                className="delete-confirm-btn"
                onClick={confirmDelete}
                disabled={deleting}
                aria-busy={deleting}
              >
                {deleting && <Spinner />}
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Attendance;
