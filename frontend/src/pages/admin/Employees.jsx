import { useEffect, useRef, useState } from "react";
import api from "../../api/axios";
import { useToast } from "../../context/ToastContext";
import { SkeletonRows } from "../../components/Skeleton";
import Spinner from "../../components/Spinner";
import SortableTh from "../../components/SortableTh";
import useSort from "../../hooks/useSort";
import useFlipList from "../../hooks/useFlipList";
import "../../styles/employees.css";

const emptyForm = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  hourlyRate: "",
  requiredTimeIn: "08:00",
};

const SORT_ACCESSORS = {
  employeeId: (emp) => emp.employeeId || "",
  name: (emp) => `${emp.firstName} ${emp.lastName}`.toLowerCase(),
  email: (emp) => (emp.email || "").toLowerCase(),
  hourlyRate: (emp) => Number(emp.hourlyRate || 0),
  requiredTimeIn: (emp) => emp.requiredTimeIn || "",
  status: (emp) => (emp.isActive ? 0 : 1),
};

const Employees = () => {
  const toast = useToast();
  const tbodyRef = useRef(null);
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  // Create / edit modal
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete modal
  const [deleteModal, setDeleteModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState(null);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const res = await api.get("/employees");
      setEmployees(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load employees.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const openCreateModal = () => {
    setEditingEmployee(null);
    setForm(emptyForm);
    setFormError("");
    setShowFormModal(true);
  };

  const openEditModal = (employee) => {
    setEditingEmployee(employee);
    setForm({
      firstName: employee.firstName || "",
      lastName: employee.lastName || "",
      email: employee.email || "",
      password: "",
      hourlyRate: employee.hourlyRate ?? "",
      requiredTimeIn: employee.requiredTimeIn || "08:00",
    });
    setFormError("");
    setShowFormModal(true);
  };

  const closeFormModal = () => {
    setShowFormModal(false);
    setEditingEmployee(null);
    setForm(emptyForm);
    setFormError("");
  };

  const saveEmployee = async (e) => {
    e.preventDefault();
    setFormError("");

    try {
      setSaving(true);

      if (editingEmployee) {
        const payload = {
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          hourlyRate: form.hourlyRate,
          requiredTimeIn: form.requiredTimeIn,
        };

        // Only reset the password when the admin typed a new one
        if (form.password) {
          payload.newPassword = form.password;
        }

        await api.put(`/employees/${editingEmployee._id}`, payload);

        toast.success(`${form.firstName} ${form.lastName} was updated.`);
      } else {
        const res = await api.post("/employees/create", form);

        toast.success(`Employee ID ${res.data.employee?.employeeId} was created.`, {
          title: "Employee created",
        });
      }

      closeFormModal();
      fetchEmployees();
    } catch (error) {
      setFormError(error.response?.data?.message || "Failed to save employee.");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (employee) => {
    try {
      setTogglingId(employee._id);

      await api.put(`/employees/${employee._id}`, {
        isActive: !employee.isActive,
      });

      toast.success(
        `${employee.firstName} ${employee.lastName} is now ${
          employee.isActive ? "inactive" : "active"
        }.`
      );

      await fetchEmployees();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update status.");
    } finally {
      setTogglingId(null);
    }
  };

  const openDeleteModal = (employee) => {
    setSelectedEmployee(employee);
    setDeleteError("");
    setDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setSelectedEmployee(null);
    setDeleteError("");
    setDeleteModal(false);
  };

  const confirmDelete = async () => {
    try {
      setDeleting(true);
      await api.delete(`/employees/${selectedEmployee._id}`);

      toast.success(
        `${selectedEmployee.firstName} ${selectedEmployee.lastName} was deleted.`
      );

      closeDeleteModal();
      fetchEmployees();
    } catch (error) {
      setDeleteError(error.response?.data?.message || "Failed to delete employee.");
    } finally {
      setDeleting(false);
    }
  };

  const filteredEmployees = employees.filter((emp) => {
    const keyword = search.toLowerCase();
    const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase();

    const matchesSearch =
      emp.employeeId?.toLowerCase().includes(keyword) ||
      fullName.includes(keyword) ||
      emp.email?.toLowerCase().includes(keyword);

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && emp.isActive) ||
      (statusFilter === "inactive" && !emp.isActive);

    return matchesSearch && matchesStatus;
  });

  const { sortedRows, sort, toggleSort } = useSort(filteredEmployees, SORT_ACCESSORS);

  useFlipList(tbodyRef, `${sort.key}-${sort.direction}-${search}-${statusFilter}`);

  return (
    <div className="employees-page">
      <div className="employees-header">
        <div>
          <h1>Employee Management</h1>
          <p>Manage employee accounts and their information.</p>
        </div>

        <button className="create-open-btn" onClick={openCreateModal}>
          + Create Employee
        </button>
      </div>

      <div className="employee-toolbar">
        <input
          type="text"
          placeholder="Search employee by ID, name, or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        <button
          className="reset-btn"
          onClick={() => {
            setSearch("");
            setStatusFilter("all");
          }}
        >
          Reset
        </button>

        <button className="search-btn" onClick={fetchEmployees} disabled={loading} aria-busy={loading}>
          {loading && <Spinner />}
          Refresh
        </button>
      </div>

      <div className="employee-table-card">
        <div className="lp-table-wrap">
          <table className="employee-table">
            <thead>
              <tr>
                <SortableTh label="Employee ID" column="employeeId" sort={sort} onSort={toggleSort} />
                <SortableTh label="Name" column="name" sort={sort} onSort={toggleSort} />
                <SortableTh label="Email" column="email" sort={sort} onSort={toggleSort} />
                <SortableTh label="Hourly Rate" column="hourlyRate" sort={sort} onSort={toggleSort} />
                <SortableTh label="Required Time In" column="requiredTimeIn" sort={sort} onSort={toggleSort} />
                <SortableTh label="Status" column="status" sort={sort} onSort={toggleSort} />
                <th>Actions</th>
              </tr>
            </thead>

            <tbody ref={tbodyRef}>
              {loading && employees.length === 0 && <SkeletonRows rows={6} cols={7} />}

              {sortedRows.map((emp) => (
                <tr key={emp._id} data-key={emp._id}>
                  <td>{emp.employeeId}</td>
                  <td>
                    {emp.firstName} {emp.lastName}
                  </td>
                  <td>{emp.email}</td>
                  <td>₱{Number(emp.hourlyRate || 0).toFixed(2)}</td>
                  <td>{emp.requiredTimeIn}</td>
                  <td>
                    <span
                      className={
                        emp.isActive ? "status active" : "status inactive"
                      }
                    >
                      {emp.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="edit-btn"
                        onClick={() => openEditModal(emp)}
                      >
                        Edit
                      </button>

                      <button
                        className="lp-btn secondary small"
                        onClick={() => toggleStatus(emp)}
                        disabled={togglingId === emp._id}
                        aria-busy={togglingId === emp._id}
                      >
                        {togglingId === emp._id && <Spinner />}
                        {emp.isActive ? "Deactivate" : "Activate"}
                      </button>

                      <button
                        className="delete-btn"
                        onClick={() => openDeleteModal(emp)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!loading && filteredEmployees.length === 0 && (
                <tr>
                  <td colSpan="7" className="empty-row">
                    No employees found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="table-footer">
          <p>
            Showing {filteredEmployees.length} of {employees.length} employees
          </p>
        </div>
      </div>

      {showFormModal && (
        <div className="modal-overlay">
          <div className="create-modal">
            <div className="modal-header">
              <div>
                <h2>{editingEmployee ? "Edit Employee" : "Create Employee"}</h2>
                <p>
                  {editingEmployee
                    ? `Employee ID: ${editingEmployee.employeeId}`
                    : "The Employee ID is generated automatically."}
                </p>
              </div>

              <button className="modal-close" onClick={closeFormModal}>
                ×
              </button>
            </div>

            {formError && <div className="lp-alert error">{formError}</div>}

            <form className="employee-form" onSubmit={saveEmployee} autoComplete="off">
              <div className="lp-form-grid">
                <div className="lp-field">
                  <label>First Name</label>
                  <input
                    name="firstName"
                    placeholder="First Name"
                    value={form.firstName}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="lp-field">
                  <label>Last Name</label>
                  <input
                    name="lastName"
                    placeholder="Last Name"
                    value={form.lastName}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="lp-field">
                <label>Email</label>
                <input
                  name="email"
                  type="email"
                  placeholder="employee@email.com"
                  autoComplete="off"
                  value={form.email}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="lp-field">
                <label>{editingEmployee ? "New Password" : "Password"}</label>
                <input
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder={
                    editingEmployee
                      ? "Leave blank to keep the current password"
                      : "At least 6 characters"
                  }
                  value={form.password}
                  onChange={handleChange}
                  minLength={6}
                  required={!editingEmployee}
                />
              </div>

              <div className="lp-form-grid">
                <div className="lp-field">
                  <label>Hourly Rate (₱)</label>
                  <input
                    name="hourlyRate"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Hourly Rate"
                    value={form.hourlyRate}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="lp-field">
                  <label>Required Time In</label>
                  <input
                    name="requiredTimeIn"
                    type="time"
                    value={form.requiredTimeIn}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              {editingEmployee && (
                <p className="lp-muted">
                  Rate and time-in changes apply to new DTR records. Existing
                  records keep the rate they were recorded with.
                </p>
              )}

              <div className="form-actions">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={closeFormModal}
                >
                  Cancel
                </button>

                <button type="submit" className="save-btn" disabled={saving} aria-busy={saving}>
                  {saving && <Spinner />}
                  {saving
                    ? "Saving..."
                    : editingEmployee
                    ? "Save Changes"
                    : "Save Employee"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteModal && selectedEmployee && (
        <div className="modal-overlay">
          <div className="delete-modal">
            <div className="warning-icon">⚠</div>

            <h2>Delete Employee</h2>

            <p>
              Are you sure you want to delete this employee?
              <br />
              <span>This action cannot be undone.</span>
            </p>

            <div className="delete-info">
              <p>
                <strong>Employee ID:</strong>{" "}
                {selectedEmployee.employeeId}
              </p>
              <p>
                <strong>Name:</strong>{" "}
                {selectedEmployee.firstName} {selectedEmployee.lastName}
              </p>
            </div>

            {deleteError && <div className="lp-alert error">{deleteError}</div>}

            <div className="modal-actions">
              <button className="cancel-btn" onClick={closeDeleteModal}>
                Cancel
              </button>

              <button
                className="confirm-delete-btn"
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

export default Employees;
