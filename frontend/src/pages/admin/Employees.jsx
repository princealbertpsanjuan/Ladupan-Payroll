import { useEffect, useState } from "react";
import api from "../../api/axios";
import "../../styles/employees.css";

const emptyForm = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  hourlyRate: "",
  requiredTimeIn: "08:00",
};

const Employees = () => {
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(false);

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

  const [message, setMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const res = await api.get("/employees");
      setEmployees(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.message || "Failed to load employees.",
      });
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

        setMessage({
          type: "success",
          text: `${form.firstName} ${form.lastName} was updated.`,
        });
      } else {
        const res = await api.post("/employees/create", form);

        setMessage({
          type: "success",
          text: `Employee created with ID ${res.data.employee?.employeeId}.`,
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
      await api.put(`/employees/${employee._id}`, {
        isActive: !employee.isActive,
      });

      setMessage({
        type: "success",
        text: `${employee.firstName} ${employee.lastName} is now ${
          employee.isActive ? "inactive" : "active"
        }.`,
      });

      fetchEmployees();
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.message || "Failed to update status.",
      });
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
      await api.delete(`/employees/${selectedEmployee._id}`);

      setMessage({
        type: "success",
        text: `${selectedEmployee.firstName} ${selectedEmployee.lastName} was deleted.`,
      });

      closeDeleteModal();
      fetchEmployees();
    } catch (error) {
      setDeleteError(error.response?.data?.message || "Failed to delete employee.");
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

      {message.text && (
        <div className={`lp-alert ${message.type}`}>{message.text}</div>
      )}

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

        <button className="search-btn" onClick={fetchEmployees}>
          Refresh
        </button>
      </div>

      <div className="employee-table-card">
        <div className="lp-table-wrap">
          <table className="employee-table">
            <thead>
              <tr>
                <th>Employee ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Hourly Rate</th>
                <th>Required Time In</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading && employees.length === 0 && (
                <tr>
                  <td colSpan="7" className="empty-row">
                    Loading employees...
                  </td>
                </tr>
              )}

              {filteredEmployees.map((emp) => (
                <tr key={emp._id}>
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
                      ● {emp.isActive ? "Active" : "Inactive"}
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
                      >
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

            <form className="employee-form" onSubmit={saveEmployee}>
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
                  placeholder="Email"
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

                <button type="submit" className="save-btn" disabled={saving}>
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

              <button className="confirm-delete-btn" onClick={confirmDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Employees;
