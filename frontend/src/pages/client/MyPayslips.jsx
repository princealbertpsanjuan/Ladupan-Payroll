import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import { formatMoney, formatLongDate } from "../../utils/format";
import { SkeletonRows } from "../../components/Skeleton";
import Icon from "../../components/Icon";

const MyPayslips = () => {
  const [payslips, setPayslips] = useState([]);
  const [cashAdvance, setCashAdvance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const [payslipRes, cashRes] = await Promise.all([
          api.get("/payslips/my"),
          api.get("/cash-advances/my"),
        ]);

        setPayslips(Array.isArray(payslipRes.data) ? payslipRes.data : []);
        setCashAdvance(cashRes.data);
      } catch (error) {
        console.error("Error fetching payslips:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredPayslips = payslips.filter((payslip) =>
    `${payslip.payrollPeriodStart} ${payslip.payrollPeriodEnd}`.includes(search)
  );

  return (
    <div className="lp-page">
      <div className="lp-header">
        <div>
          <h1>My Payslips</h1>
          <p>View and print your payslip for every generated payroll.</p>
        </div>
      </div>

      <div className="lp-card">
        <div className="lp-toolbar">
          <input
            type="text"
            placeholder="Search by payroll period (e.g. 2026-11)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="lp-table-wrap">
          <table className="lp-table">
            <thead>
              <tr>
                <th>Payroll Period</th>
                <th>Generated</th>
                <th>Total Hours</th>
                <th>Gross Pay</th>
                <th>Deductions</th>
                <th>Net Pay</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <SkeletonRows rows={6} cols={7} />
              ) : filteredPayslips.length > 0 ? (
                filteredPayslips.map((payslip) => {
                  const expanded = expandedId === payslip.reportId;

                  return (
                  <Fragment key={payslip.reportId}>
                  <tr className={expanded ? "is-expanded" : ""}>
                    <td>
                      {payslip.payrollPeriodStart} to {payslip.payrollPeriodEnd}
                    </td>
                    <td>{formatLongDate(payslip.generatedDate)}</td>
                    <td>{payslip.totalHours}</td>
                    <td>{formatMoney(payslip.grossSalary)}</td>
                    <td>{formatMoney(payslip.totalDeductions)}</td>
                    <td>
                      <strong>{formatMoney(payslip.netSalary)}</strong>
                    </td>
                    <td>
                      <div className="lp-btn-row">
                        <button
                          type="button"
                          className="lp-btn secondary small"
                          aria-expanded={expanded}
                          onClick={() => setExpandedId(expanded ? null : payslip.reportId)}
                        >
                          Preview
                          <Icon name="chevronDown" size={14} className="preview-chevron" />
                        </button>
                        <Link
                          className="lp-btn small"
                          to={`/client/payslips/${payslip.reportId}`}
                        >
                          View Payslip
                        </Link>
                      </div>
                    </td>
                  </tr>

                  {expanded && (
                    <tr className="payslip-preview-row">
                      <td colSpan="7">
                        <div className="payslip-preview">
                          <div>
                            <span>Hours worked</span>
                            <strong>{payslip.totalHours}</strong>
                          </div>
                          <div>
                            <span>Gross pay</span>
                            <strong>{formatMoney(payslip.grossSalary)}</strong>
                          </div>
                          <div>
                            <span>Deductions</span>
                            <strong>− {formatMoney(payslip.totalDeductions)}</strong>
                          </div>
                          <div className="is-net">
                            <span>Net pay</span>
                            <strong>{formatMoney(payslip.netSalary)}</strong>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7" className="lp-empty">
                    No payslips yet. A payslip appears here once the admin
                    generates a payroll that includes you.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {cashAdvance && cashAdvance.entries?.length > 0 && (
        <div className="lp-card">
          <h2>My Cash Advances</h2>
          <p className="lp-card-subtitle">
            Unpaid balance: <strong>{formatMoney(cashAdvance.balance)}</strong>
          </p>

          <div className="lp-table-wrap">
            <table className="lp-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {cashAdvance.entries.map((entry) => (
                  <tr key={entry._id}>
                    <td>{entry.date}</td>
                    <td>
                      <span className={`lp-badge ${entry.type}`}>
                        {entry.type === "advance" ? "Cash Advance" : "Paid via Payroll"}
                      </span>
                    </td>
                    <td>{formatMoney(entry.amount)}</td>
                    <td>
                      {entry.note || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyPayslips;
