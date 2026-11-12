import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/axios";
import { SkeletonBlock } from "../../components/Skeleton";
import logo from "../../assets/ladupan-logo.png";
import {
  formatMoney,
  formatDate,
  formatLongDate,
  formatMinutes,
} from "../../utils/format";
import "../../styles/payslip.css";

// Printable payslip.
// Admin:    /admin/payslip/:reportId/:employeeId
// Employee: /client/payslips/:reportId (own payslip only)
const PayslipPage = ({ admin = false }) => {
  const { reportId, employeeId } = useParams();
  const navigate = useNavigate();

  const [payslip, setPayslip] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPayslip = async () => {
      try {
        setLoading(true);

        const url = admin
          ? `/payslips/${reportId}/${employeeId}`
          : `/payslips/my/${reportId}`;

        const res = await api.get(url);
        setPayslip(res.data);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load payslip.");
      } finally {
        setLoading(false);
      }
    };

    fetchPayslip();
  }, [admin, reportId, employeeId]);

  if (loading) {
    return (
      <div className="lp-page" aria-busy="true">
        <div className="lp-header">
          <div>
            <h1>Payslip</h1>
            <p>Preparing your payslip…</p>
          </div>
        </div>

        <div className="payslip-sheet payslip-skeleton">
          <SkeletonBlock lines={2} />
          <div className="payslip-skeleton-grid">
            <SkeletonBlock lines={2} />
            <SkeletonBlock lines={2} />
            <SkeletonBlock lines={2} />
            <SkeletonBlock lines={2} />
          </div>
          <div className="payslip-skeleton-grid two">
            <SkeletonBlock lines={5} />
            <SkeletonBlock lines={5} />
          </div>
          <SkeletonBlock lines={6} />
        </div>
      </div>
    );
  }

  if (error || !payslip) {
    return (
      <div className="lp-page">
        <div className="lp-alert error">{error || "Payslip not found."}</div>
        <button className="lp-btn secondary" onClick={() => navigate(-1)}>
          ← Back
        </button>
      </div>
    );
  }

  const { summary } = payslip;
  const totalDeductions =
    (summary.lateDeductions || 0) + (summary.cashAdvance || 0) + (summary.otherDeductions || 0);

  return (
    <div className="lp-page">
      <div className="lp-header no-print">
        <div>
          <h1>Payslip</h1>
          <p>
            {payslip.employee.name} · {payslip.payrollPeriodStart} to{" "}
            {payslip.payrollPeriodEnd}
          </p>
        </div>

        <div className="lp-btn-row">
          <button className="lp-btn secondary" onClick={() => navigate(-1)}>
            ← Back
          </button>
          <button className="lp-btn" onClick={() => window.print()}>
            Print / Save as PDF
          </button>
        </div>
      </div>

      <div className="payslip-sheet">
        <div className="payslip-top">
          <div className="payslip-brand">
            <img src={logo} alt="Ladupan Logo" />
            <div>
              <h2>Ladupan</h2>
              <p>Employee Payslip</p>
            </div>
          </div>

          <div className="payslip-period">
            <span>Payroll Period</span>
            <strong>
              {formatLongDate(`${payslip.payrollPeriodStart}T00:00:00`)} –{" "}
              {formatLongDate(`${payslip.payrollPeriodEnd}T00:00:00`)}
            </strong>
            <span>Generated {formatLongDate(payslip.generatedDate)}</span>
          </div>
        </div>

        <div className="payslip-info">
          <div>
            <span>Employee Name</span>
            <strong>{payslip.employee.name}</strong>
          </div>
          <div>
            <span>Employee ID</span>
            <strong>{payslip.employee.employeeId}</strong>
          </div>
          <div>
            <span>Hourly Rate</span>
            <strong>{formatMoney(summary.hourlyRate)}</strong>
          </div>
          <div>
            <span>Total Hours</span>
            <strong>{summary.totalHours}</strong>
          </div>
        </div>

        <div className="payslip-columns">
          <div className="payslip-box">
            <h3>Attendance Summary</h3>
            <div className="payslip-line">
              <span>Present</span>
              <strong>{summary.totalPresent} day(s)</strong>
            </div>
            <div className="payslip-line">
              <span>Late</span>
              <strong>{summary.totalLate} day(s)</strong>
            </div>
            <div className="payslip-line">
              <span>Absent</span>
              <strong>{summary.totalAbsent} day(s)</strong>
            </div>
            {summary.totalIncomplete > 0 && (
              <div className="payslip-line">
                <span>No time-out (0 hours)</span>
                <strong>{summary.totalIncomplete} day(s)</strong>
              </div>
            )}
            <div className="payslip-line">
              <span>Total late time</span>
              <strong>{formatMinutes(summary.totalLateMinutes)}</strong>
            </div>
          </div>

          <div className="payslip-box">
            <h3>Earnings & Deductions</h3>
            <div className="payslip-line">
              <span>Gross Pay</span>
              <strong>{formatMoney(summary.grossSalary)}</strong>
            </div>
            {summary.lateDeductions > 0 && (
              <div className="payslip-line">
                <span>Late Deduction</span>
                <strong>− {formatMoney(summary.lateDeductions)}</strong>
              </div>
            )}
            <div className="payslip-line">
              <span>Cash Advance</span>
              <strong>− {formatMoney(summary.cashAdvance)}</strong>
            </div>
            <div className="payslip-line">
              <span>
                Other Deductions
                {summary.otherDeductionsNote && (
                  <em className="payslip-note"> ({summary.otherDeductionsNote})</em>
                )}
              </span>
              <strong>− {formatMoney(summary.otherDeductions)}</strong>
            </div>
            <div className="payslip-line">
              <span>Total Deductions</span>
              <strong>− {formatMoney(totalDeductions)}</strong>
            </div>
            <div className="payslip-line payslip-net">
              <span>NET PAY</span>
              <strong>{formatMoney(summary.netSalary)}</strong>
            </div>
          </div>
        </div>

        <h3 className="payslip-section-title">Daily Time Record</h3>

        <table className="payslip-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Required In</th>
              <th>Time In</th>
              <th>Time Out</th>
              <th>Late</th>
              <th>Hours</th>
              <th>Gross Pay</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {payslip.records.length > 0 ? (
              payslip.records.map((record) => (
                <tr key={record._id}>
                  <td>{formatDate(record.date)}</td>
                  <td>{record.requiredTimeIn || "-"}</td>
                  <td>{record.timeIn || "-"}</td>
                  <td>{record.timeOut || "-"}</td>
                  <td>{formatMinutes(record.lateMinutes)}</td>
                  <td>{record.totalHours || 0}</td>
                  <td>{formatMoney(record.grossPay)}</td>
                  <td>{record.timeIn && !record.timeOut && record.remarks !== "Absent" ? `${record.remarks} (no time-out)` : record.remarks}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className="lp-empty">
                  No DTR records linked to this payroll.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="payslip-footer">
          <div>
            <div className="payslip-sign"></div>
            <span>Prepared by: {payslip.generatedBy}</span>
          </div>
          <div>
            <div className="payslip-sign"></div>
            <span>Received by: {payslip.employee.name}</span>
          </div>
        </div>

        <p className="payslip-disclaimer">
          This payslip is generated by the Ladupan Payroll System from the
          payroll report of this period.
        </p>
      </div>
    </div>
  );
};

export default PayslipPage;
