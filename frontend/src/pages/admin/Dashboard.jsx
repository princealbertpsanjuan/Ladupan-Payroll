import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";
import Icon from "../../components/Icon";
import CountUp from "../../components/CountUp";
import { SkeletonText } from "../../components/Skeleton";
import "../../styles/adminDashboard.css";

const QUICK_LINKS = [
  { to: "/admin/employees", icon: "users", tone: "purple", title: "Employee Management", text: "Create, update, and manage employee accounts." },
  { to: "/admin/attendance", icon: "clock", tone: "green", title: "Attendance Records", text: "Monitor employee DTR and attendance activity." },
  { to: "/admin/payroll", icon: "payroll", tone: "orange", title: "Payroll Generation", text: "Generate payroll for selected employees and date range." },
  { to: "/admin/reports", icon: "report", tone: "blue", title: "Payroll Reports", text: "View and print generated payroll summaries." },
  { to: "/admin/archives", icon: "archive", tone: "red", title: "Archives", text: "Access archived payroll and attendance records." },
  { to: "/admin/corrections", icon: "edit", tone: "purple", title: "DTR Corrections", text: "Review employee requests to fix their time records." },
  { to: "/admin/cash-advances", icon: "cash", tone: "green", title: "Cash Advances", text: "Record advances and track repayments through payroll." },
  { to: "/admin/audit-log", icon: "shield", tone: "blue", title: "Audit Log", text: "See who changed employees, DTRs, and payroll." },
];

// Shows a placeholder while loading, then counts up to the real value
const Value = ({ loading, value, format = "integer", delay = 0 }) =>
  loading ? (
    <SkeletonText width={format === "money" ? 120 : 48} />
  ) : (
    <CountUp value={value} format={format} delay={delay} />
  );

const Dashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({
    activeDTR: 0,
    totalEmployees: 0,
    generatedPayrolls: 0,
    archivedRecords: 0,
    incompleteRecords: 0,
    pendingCorrections: 0,
    timedInToday: 0,
    outstandingCashAdvances: 0,
    latestPayrollTotals: null,
    latestPayrolls: [],
    recentPayrollActivity: {
      lastPayrollPeriod: "Not generated yet",
      processedEmployees: 0,
      lastGeneratedBy: "Not available",
      lastGeneratedDate: "Not available",
    },
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const res = await api.get("/dashboard/admin");
      setStats((current) => ({ ...current, ...res.data }));
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    if (!date || date === "Not available") {
      return "Not available";
    }

    return new Date(date).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const totals = stats.latestPayrollTotals;

  return (
    <div className="admin-dashboard">
      <section className="dashboard-hero">
        <div>
          <h1>Welcome, {user?.firstName} 👋</h1>
          <p>Here’s what’s happening in your payroll system.</p>
        </div>

        <div className="dashboard-date">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </div>
      </section>

      <section>
        <h2 className="section-title">
          Latest Payroll
          {totals && <span className="section-meta">{totals.period}</span>}
        </h2>

        {loading || totals ? (
          <div className="payroll-totals lp-stagger">
            <div className="total-card">
              <span className="total-label">Gross Pay</span>
              <strong>
                <Value loading={loading} value={totals?.grossPay} format="money" />
              </strong>
              <p>{totals ? `${totals.totalEmployees} employee(s) paid` : " "}</p>
            </div>

            <div className="total-card">
              <span className="total-label">Deductions</span>
              <strong>
                <Value loading={loading} value={totals?.deductions} format="money" delay={40} />
              </strong>
              <p>Cash advances and other deductions</p>
            </div>

            <div className="total-card is-primary">
              <span className="total-label">Net Pay</span>
              <strong>
                <Value loading={loading} value={totals?.netPay} format="money" delay={80} />
              </strong>
              <p>Total paid out this period</p>
            </div>
          </div>
        ) : (
          <div className="lp-card lp-empty-card">
            <p>No payroll has been generated yet. Totals appear here after your first payroll.</p>
            <Link to="/admin/payroll" className="lp-btn small">
              Go to Payroll
            </Link>
          </div>
        )}
      </section>

      <section>
        <h2 className="section-title">Overview</h2>

        <div className="overview-grid lp-stagger">
          <div className="overview-card">
            <div className="overview-icon blue">
              <Icon name="records" />
            </div>
            <div>
              <h3>Active DTR Records</h3>
              <strong>
                <Value loading={loading} value={stats.activeDTR} />
              </strong>
              <p>Records not yet included in payroll</p>
            </div>
          </div>

          <div className="overview-card">
            <div className="overview-icon green">
              <Icon name="users" />
            </div>
            <div>
              <h3>Total Employees</h3>
              <strong>
                <Value loading={loading} value={stats.totalEmployees} delay={40} />
              </strong>
              <p>All active employees in the system</p>
            </div>
          </div>

          <div className="overview-card">
            <div className="overview-icon purple">
              <Icon name="receipt" />
            </div>
            <div>
              <h3>Generated Payrolls</h3>
              <strong>
                <Value loading={loading} value={stats.generatedPayrolls} delay={80} />
              </strong>
              <p>Payroll reports generated</p>
            </div>
          </div>

          <div className="overview-card">
            <div className="overview-icon orange">
              <Icon name="archive" />
            </div>
            <div>
              <h3>Archived Records</h3>
              <strong>
                <Value loading={loading} value={stats.archivedRecords} delay={120} />
              </strong>
              <p>Payroll and attendance records archived</p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="section-title">Needs Attention</h2>

        <div className="lp-stat-grid lp-stagger">
          <Link
            to="/admin/attendance?filter=incomplete"
            className={`lp-stat ${stats.incompleteRecords > 0 ? "attention" : ""}`}
          >
            <span>DTRs without time-out (before today)</span>
            <strong>
              <Value loading={loading} value={stats.incompleteRecords} />
            </strong>
          </Link>

          <Link
            to="/admin/corrections"
            className={`lp-stat ${stats.pendingCorrections > 0 ? "attention" : ""}`}
          >
            <span>Pending DTR corrections</span>
            <strong>
              <Value loading={loading} value={stats.pendingCorrections} />
            </strong>
          </Link>

          <Link to="/admin/attendance" className="lp-stat">
            <span>Employees timed in today</span>
            <strong>
              <Value loading={loading} value={stats.timedInToday} />
            </strong>
          </Link>

          <Link to="/admin/cash-advances" className="lp-stat">
            <span>Unpaid cash advances</span>
            <strong>
              <Value loading={loading} value={stats.outstandingCashAdvances} format="money" />
            </strong>
          </Link>
        </div>
      </section>

      <section>
        <h2 className="section-title">Quick Access</h2>

        <div className="quick-grid lp-stagger">
          {QUICK_LINKS.map((item) => (
            <Link key={item.to} to={item.to} className="quick-card">
              <div className={`card-icon ${item.tone}`}>
                <Icon name={item.icon} />
              </div>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
              <span>
                <Icon name="arrowRight" size={18} />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="activity-card">
        <h2>Recent Payroll Activity</h2>

        <div className="activity-grid">
          <div>
            <span>Last Payroll Period</span>
            <h3>{stats.recentPayrollActivity.lastPayrollPeriod}</h3>
            <p>Based on latest generated payroll.</p>
          </div>

          <div>
            <span>Recently Processed Employees</span>
            <h3>
              {stats.recentPayrollActivity.processedEmployees} employees
            </h3>
            <p>Included in latest payroll report.</p>
          </div>

          <div>
            <span>Last Generated By</span>
            <h3>{stats.recentPayrollActivity.lastGeneratedBy}</h3>
            <p>Administrator</p>
          </div>

          <div>
            <span>Last Generated Date</span>
            <h3>
              {formatDate(stats.recentPayrollActivity.lastGeneratedDate)}
            </h3>
            <p>Latest payroll generation date.</p>
          </div>
        </div>

        {stats.latestPayrolls?.length > 0 && (
          <div className="lp-table-wrap" style={{ margin: "20px 0" }}>
            <table className="lp-table">
              <thead>
                <tr>
                  <th>Latest Payrolls</th>
                  <th>Employees</th>
                  <th>Total Net Pay</th>
                  <th>Generated By</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {stats.latestPayrolls.map((payroll) => (
                  <tr key={payroll._id}>
                    <td>{payroll.period}</td>
                    <td>{payroll.totalEmployees}</td>
                    <td>
                      {`₱${Number(payroll.totalNet || 0).toLocaleString("en-PH", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`}
                    </td>
                    <td>{payroll.generatedBy || "-"}</td>
                    <td>{formatDate(payroll.generatedDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Link to="/admin/reports" className="latest-btn">
          View Payroll Reports
          <Icon name="arrowRight" size={16} />
        </Link>
      </section>
    </div>
  );
};

export default Dashboard;
