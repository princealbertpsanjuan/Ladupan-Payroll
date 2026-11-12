import { useEffect, useState } from "react";
import api from "../../api/axios";
import StatusBadge from "../../components/StatusBadge";
import { formatMinutes } from "../../utils/format";
import "../../styles/myarchives.css";
import { SkeletonRows } from "../../components/Skeleton";

const MyArchives = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    fetchArchives();
  }, []);

  const fetchArchives = async () => {
    try {
      setLoading(true);

      const res = await api.get("/attendance/my-archives");

      const archiveList = Array.isArray(res.data)
        ? res.data
        : res.data.records || [];

      setRecords(archiveList);
    } catch (error) {
      console.log(error);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  const formatMoney = (value) => {
    return `₱${Number(value || 0).toFixed(2)}`;
  };

  const formatDate = (date) => {
    if (!date) return "-";
    return date.includes("T") ? date.slice(0, 10) : date;
  };

  const filteredRecords = records.filter((record) => {
    const matchesSearch =
      record.date?.toLowerCase().includes(search.toLowerCase()) ||
      record.remarks?.toLowerCase().includes(search.toLowerCase());

    const matchesFilter =
      filter === "All" || record.remarks === filter;

    return matchesSearch && matchesFilter;
  });

  return (
    <div className="myarchives-page">
      <div className="myarchives-header">
        <div>
          <h1>My Archived DTR Records</h1>

          <p>
            View your archived attendance records already included in payroll.
          </p>
        </div>
      </div>

      <div className="myarchives-card">
        <div className="myarchives-tools">
          <input
            type="text"
            placeholder="Search by date or remarks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="All">All Remarks</option>
            <option value="Present">Present</option>
            <option value="Late">Late</option>
            <option value="Absent">Absent</option>
          </select>
        </div>

        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Required Time In</th>
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
              <SkeletonRows rows={6} cols={9} />
            ) : filteredRecords.length > 0 ? (
              filteredRecords.map((record) => (
                <tr key={record._id}>
                  <td>{formatDate(record.date)}</td>

                  <td>{record.requiredTimeIn || "-"}</td>

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
                  No archived records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="myarchives-footer">
          Showing {filteredRecords.length} archived attendance record
          {filteredRecords.length !== 1 ? "s" : ""}
        </div>
      </div>
    </div>
  );
};

export default MyArchives;