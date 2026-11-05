import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import logo from "../assets/ladupan-logo.png";
import "../styles/layout.css";

const AdminLayout = ({ children }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src={logo} alt="Ladupan Logo" className="sidebar-logo" />
          <h2>Ladupan</h2>
          <p>Admin Panel</p>
        </div>

        <nav>
          <NavLink to="/admin/dashboard">Dashboard</NavLink>
          <NavLink to="/admin/employees">Employees</NavLink>
          <NavLink to="/admin/attendance">Attendance</NavLink>
          <NavLink to="/admin/corrections">DTR Corrections</NavLink>
          <NavLink to="/admin/payroll">Payroll</NavLink>
          <NavLink to="/admin/cash-advances">Cash Advances</NavLink>
          <NavLink to="/admin/reports">Reports</NavLink>
          <NavLink to="/admin/archives">Archives</NavLink>
          <NavLink to="/admin/audit-log">Audit Log</NavLink>
        </nav>

        <button className="logout-btn" onClick={handleLogout}>Logout</button>
      </aside>

      <main className="main-content">
        {children}
      </main>
    </div>
  );
};

export default AdminLayout;