import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import logo from "../assets/ladupan-logo.png";
import "../styles/layout.css";

const ClientLayout = ({ children }) => {
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
          <p>Employee Portal</p>
        </div>

        <nav>
          <NavLink to="/client/dashboard">Dashboard</NavLink>
          <NavLink to="/client/time">Time In / Out</NavLink>
          <NavLink to="/client/records">My Records</NavLink>
          <NavLink to="/client/corrections">DTR Corrections</NavLink>
          <NavLink to="/client/payslips">My Payslips</NavLink>
          <NavLink to="/client/archives">My Archives</NavLink>
          <NavLink to="/client/account">My Account</NavLink>
        </nav>

        <button className="logout-btn" onClick={handleLogout}>
          Logout
        </button>
      </aside>

      <main className="main-content">{children}</main>
    </div>
  );
};

export default ClientLayout;