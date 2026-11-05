import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../api/axios";
import StatusBadge from "../../components/StatusBadge";
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

const Attendance = () => {
  const [searchParams] = useSearchParams();

  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [deleteRecord, setDeleteRecord] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [message, setMessage] = useState("");

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
      if (editingRecord) {
        await api.put(`/attendance/${editingRecord._id}`, payload);
        setMessage("Attendance record updated.");
      } else {
        await api.post("/attendance", payload);
        setMessage("Attendance record added.");
      }

      closeModal();
      fetchAttendance();
    } catch (err) {
      setFormError(err.response?.data?.message || "Failed to save attendance record.");
    }
  };

  const confirmDelete = async () => {
    try {
      await api.delete(`/attendance/${deleteRecord._id}`);
      setDeleteRecord(null);
      setDeleteError("");
      setMessage("Attendance record deleted.");
      fetchAttendance();
    } catch (err) {
      setDeleteError(err.response?.data?.message || "Failed to delete attendance record.");
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

      {message && <div className="lp-alert success">{message}</div>}

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
        </div>

        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Date</th>
              <th>Required In</th>
              <th>Time In</th>
              <th>Time Out</th>
              <th>Total Hours</th>
              <th>Hourly Rate</th>
              <th>Gross Pay</th>
              <th>Late</th>
              <th>Remarks</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {loading && records.length === 0 ? (
              <tr>
                <td colSpan="11" className="empty-text">
                  Loading attendance records...
                </td>
              </tr>
            ) : filteredRecords.length > 0 ? (
              filteredRecords.map((record) => (
                <tr key={record._id}>
                  <td>
                    {getEmployeeName(record.employee)}
                    <div className="lp-muted">{record.employee?.employeeId}</div>
                  </td>
                  <td>{formatDate(record.date)}</td>
                  <td>{record.requiredTimeIn || "-"}</td>
                  <td>{record.timeIn || "-"}</td>
                  <td>{record.timeOut || "-"}</td>
                  <td>{record.totalHours || 0}</td>
                  <td>{formatMoney(record.hourlyRate)}</td>
                  <td>{formatMoney(record.grossPay)}</td>
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
              ))
            ) : (
              <tr>
                <td colSpan="11" className="empty-text">
                  No attendance records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="attendance-footer">
          Showing {filteredRecords.length} of {records.length} active DTR record
          {records.length !== 1 ? "s" : ""}
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

                <button type="submit" className="save-btn">
                  {editingRecord ? "Update" : "Save"}
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

              <button className="delete-confirm-btn" onClick={confirmDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Attendance;
