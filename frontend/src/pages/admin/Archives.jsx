import { useEffect, useState } from "react";
import api from "../../api/axios";
import StatusBadge from "../../components/StatusBadge";
import { formatMinutes } from "../../utils/format";
import "../../styles/archives.css";

const Archives = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");

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

  const getEmployeeName = (employee) => {
    if (!employee) return "Deleted employee";

    return `${employee.firstName || ""} ${
      employee.lastName || ""
    }`.trim();
  };

  const formatMoney = (value) => {
    return `₱${Number(value || 0).toFixed(2)}`;
  };

  const formatDate = (date) => {
    if (!date) return "-";
    return date.includes("T") ? date.slice(0, 10) : date;
  };

  const years = [
    "All",
    ...new Set(
      records
        .map((record) =>
          new Date(record.createdAt).getFullYear().toString()
        )
        .filter((year) => year !== "NaN")
    ),
  ];

  const filteredRecords = records.filter((record) => {
    const employee = getEmployeeName(record.employee).toLowerCase();

    const payrollPeriod = `${
      record.payrollReport?.payrollPeriodStart || ""
    } ${
      record.payrollReport?.payrollPeriodEnd || ""
    }`.toLowerCase();

    const matchesSearch =
      employee.includes(search.toLowerCase()) ||
      payrollPeriod.includes(search.toLowerCase());

    const recordYear = new Date(record.createdAt)
      .getFullYear()
      .toString();

    const matchesFilter =
      filter === "All" || recordYear === filter;

    return matchesSearch && matchesFilter;
  });

  return (
    <div className="archives-page">
      <div className="archives-header">
        <div>
          <h1>Archived Attendance Records</h1>

          <p>
            View archived payroll attendance records and generated payroll periods.
          </p>
        </div>
      </div>

      <div className="archives-card">
        <div className="archives-tools">
          <input
            type="text"
            placeholder="Search employee or payroll period..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year === "All" ? "All Years" : year}
              </option>
            ))}
          </select>
        </div>

        <table>
          <thead>
            <tr>
              <th>Employee</th>
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

          <tbody>
            {loading ? (
              <tr>
                <td colSpan="9" className="empty-text">
                  Loading archived records...
                </td>
              </tr>
            ) : filteredRecords.length > 0 ? (
              filteredRecords.map((record) => (
                <tr key={record._id}>
                  <td>{getEmployeeName(record.employee)}</td>

                  <td>{formatDate(record.date)}</td>

                  <td>{record.timeIn || "-"}</td>

                  <td>{record.timeOut || "-"}</td>

                  <td>{record.totalHours || 0}</td>

                  <td>{formatMoney(record.grossPay)}</td>

                  <td>{formatMinutes(record.lateMinutes)}</td>

                  <td>
                    <StatusBadge record={record} />
                  </td>

                  <td>
                    {record.payrollReport?.payrollPeriodStart || "-"} to{" "}
                    {record.payrollReport?.payrollPeriodEnd || "-"}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="9" className="empty-text">
                  No archived attendance records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="archives-footer">
          Showing {filteredRecords.length} archived attendance record
          {filteredRecords.length !== 1 ? "s" : ""}
        </div>
      </div>
    </div>
  );
};

export default Archives;