import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";
import Icon from "../../components/Icon";
import CountUp from "../../components/CountUp";
import { SkeletonText } from "../../components/Skeleton";
import "../../styles/client.css";

const ClientDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get("/dashboard/employee");
        setStats(res.data);
      } catch (error) {
        console.error("Error fetching dashboard:", error);
      }
    };

    fetchStats();
  }, []);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Manila",
  });

  const todayStatus = () => {
    if (!stats) return "-";
    if (!stats.todayRecord) return "Not timed in";
    if (!stats.todayRecord.timeOut) return `In at ${stats.todayRecord.timeIn}`;
    return `${stats.todayRecord.timeIn} – ${stats.todayRecord.timeOut}`;
  };

  return (
    <div className="client-dashboard-page">
      <div className="client-welcome-card">
        <div>
          <h1>
            Welcome, {user?.firstName || "Employee"} 👋
          </h1>
          <p>Ladupan Payroll Employee Portal</p>
        </div>

        <span>{today}</span>
      </div>

      <h2 className="client-section-title">Quick Access</h2>

      <div className="client-quick-grid lp-stagger">
        <Link to="/client/time" className="client-quick-card">
          <div className="client-icon purple"><Icon name="clock" /></div>
          <h3>Time In / Out</h3>
          <p>Time In and Time Out for your daily attendance.</p>
          <span>
            <Icon name="arrowRight" size={18} />
          </span>
        </Link>

        <Link to="/client/records" className="client-quick-card">
          <div className="client-icon green"><Icon name="records" /></div>
          <h3>My Records</h3>
          <p>View your active DTR records not yet archived.</p>
          <span>
            <Icon name="arrowRight" size={18} />
          </span>
        </Link>

        <Link to="/client/payslips" className="client-quick-card">
          <div className="client-icon blue"><Icon name="receipt" /></div>
          <h3>My Payslips</h3>
          <p>View and print your payslips for each payroll.</p>
          <span>
            <Icon name="arrowRight" size={18} />
          </span>
        </Link>

        <Link to="/client/corrections" className="client-quick-card">
          <div className="client-icon orange"><Icon name="edit" /></div>
          <h3>DTR Corrections</h3>
          <p>Request a fix for a wrong or missing time entry.</p>
          <span>
            <Icon name="arrowRight" size={18} />
          </span>
        </Link>

        <Link to="/client/archives" className="client-quick-card">
          <div className="client-icon orange"><Icon name="archive" /></div>
          <h3>My Archives</h3>
          <p>Access your archived DTR records from payroll.</p>
          <span>
            <Icon name="arrowRight" size={18} />
          </span>
        </Link>

        <Link to="/client/account" className="client-quick-card">
          <div className="client-icon blue"><Icon name="user" /></div>
          <h3>My Account</h3>
          <p>View your account and change your password.</p>
          <span>
            <Icon name="arrowRight" size={18} />
          </span>
        </Link>
      </div>

      <h2 className="client-section-title">Overview</h2>

      <div className="client-overview-grid lp-stagger">
        <div className="client-overview-card">
          <div className="client-icon purple"><Icon name="clock" /></div>
          <div>
            <h4>Today</h4>
            <strong>{stats ? todayStatus() : <SkeletonText width={90} />}</strong>
            <p>{stats?.today || "Today's"} attendance.</p>
          </div>
        </div>

        <div className="client-overview-card">
          <div className="client-icon green"><Icon name="records" /></div>
          <div>
            <h4>Active Records</h4>
            <strong>
              {stats ? <CountUp value={stats.activeRecords} /> : <SkeletonText width={40} />}
            </strong>
            <p>DTR records not yet included in payroll.</p>
          </div>
        </div>

        <div className="client-overview-card">
          <div className="client-icon blue"><Icon name="receipt" /></div>
          <div>
            <h4>Latest Net Pay</h4>
            <strong>
              {!stats ? (
                <SkeletonText width={110} />
              ) : stats.latestPayslip ? (
                <CountUp value={stats.latestPayslip.netSalary} format="money" delay={40} />
              ) : (
                "None yet"
              )}
            </strong>
            <p>
              {stats?.latestPayslip
                ? stats.latestPayslip.period
                : "No payroll generated for you yet."}
            </p>
          </div>
        </div>

        <div className="client-overview-card">
          <div className="client-icon orange"><Icon name="cash" /></div>
          <div>
            <h4>Cash Advance Balance</h4>
            <strong>
              {stats ? (
                <CountUp value={stats.cashAdvanceBalance} format="money" delay={80} />
              ) : (
                <SkeletonText width={100} />
              )}
            </strong>
            <p>Unpaid balance deducted through payroll.</p>
          </div>
        </div>

        {stats?.pendingCorrections > 0 && (
          <div className="client-overview-card">
            <div className="client-icon purple"><Icon name="edit" /></div>
            <div>
              <h4>Pending Corrections</h4>
              <strong>{stats.pendingCorrections}</strong>
              <p>Waiting for admin review.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientDashboard;
