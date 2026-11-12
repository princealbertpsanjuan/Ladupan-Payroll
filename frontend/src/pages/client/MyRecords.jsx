import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import StatusBadge from "../../components/StatusBadge";
import { formatMinutes, isIncompleteRecord } from "../../utils/format";
import "../../styles/myrecords.css";
import { SkeletonRows } from "../../components/Skeleton";

const MyRecords = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    try {
      setLoading(true);

      const res = await api.get("/attendance/my-records");

      const recordList = Array.isArray(res.data)
        ? res.data
        : res.data.records || [];

      setRecords(recordList);
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
      filter === "All" ||
      (filter === "Incomplete" && isIncompleteRecord(record)) ||
      record.remarks === filter;

    return matchesSearch && matchesFilter;
  });

  return (
    <div className="myrecords-page">
      <div className="myrecords-header">
        <div>
          <h1>My Attendance Records</h1>

          <p>
            View your active DTR records that are not yet archived.
          </p>
        </div>
      </div>

      <div className="myrecords-card">
        <div className="myrecords-tools">
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
            <option value="Incomplete">No time-out</option>
          </select>

          <Link to="/client/corrections" className="lp-btn secondary">
            Request Correction
          </Link>
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
              <th>Action</th>
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
                    <Link
                      className="lp-btn secondary small"
                      to={`/client/corrections?date=${formatDate(record.date)}`}
                    >
                      Request Correction
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="9" className="empty-text">
                  No attendance records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="myrecords-footer">
          Showing {filteredRecords.length} active attendance record
          {filteredRecords.length !== 1 ? "s" : ""}
        </div>
      </div>
    </div>
  );
};

export default MyRecords;