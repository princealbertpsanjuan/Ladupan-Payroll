import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/auth/Login";

// ADMIN PAGES
import Dashboard from "./pages/admin/Dashboard";
import Employees from "./pages/admin/Employees";
import Attendance from "./pages/admin/Attendance";
import Payroll from "./pages/admin/Payroll";
import Reports from "./pages/admin/Reports";
import Archives from "./pages/admin/Archives";
import Corrections from "./pages/admin/Corrections";
import CashAdvances from "./pages/admin/CashAdvances";
import AuditLog from "./pages/admin/AuditLog";

// CLIENT PAGES
import ClientDashboard from "./pages/client/ClientDashboard";
import TimeInOut from "./pages/client/TimeInOut";
import MyRecords from "./pages/client/MyRecords";
import MyArchives from "./pages/client/MyArchives";
import MyAccount from "./pages/client/MyAccount";
import MyPayslips from "./pages/client/MyPayslips";
import MyCorrections from "./pages/client/MyCorrections";

// SHARED PAGES
import PayslipPage from "./pages/shared/PayslipPage";

// ROUTES & LAYOUTS
import ProtectedRoute from "./routes/ProtectedRoute";
import AdminLayout from "./layouts/AdminLayout";
import ClientLayout from "./layouts/ClientLayout";

// Theme and motion load last so they apply on top of the page styles
import "./styles/theme.css";
import "./styles/motion.css";

// Each side uses ONE layout route, so the sidebar stays mounted while the
// pages inside it change (this lets the active-menu indicator slide and the
// page content fade between routes).
function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* LOGIN */}
        <Route path="/" element={<Login />} />

        {/* ADMIN ROUTES */}
        <Route
          element={
            <ProtectedRoute allowedRole="admin">
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/admin/dashboard" element={<Dashboard />} />
          <Route path="/admin/employees" element={<Employees />} />
          <Route path="/admin/attendance" element={<Attendance />} />
          <Route path="/admin/payroll" element={<Payroll />} />
          <Route path="/admin/reports" element={<Reports />} />
          <Route path="/admin/archives" element={<Archives />} />
          <Route path="/admin/corrections" element={<Corrections />} />
          <Route path="/admin/cash-advances" element={<CashAdvances />} />
          <Route path="/admin/audit-log" element={<AuditLog />} />
          <Route
            path="/admin/payslip/:reportId/:employeeId"
            element={<PayslipPage admin />}
          />
        </Route>

        {/* CLIENT ROUTES */}
        <Route
          element={
            <ProtectedRoute allowedRole="employee">
              <ClientLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/client/dashboard" element={<ClientDashboard />} />
          <Route path="/client/time" element={<TimeInOut />} />
          <Route path="/client/records" element={<MyRecords />} />
          <Route path="/client/archives" element={<MyArchives />} />
          <Route path="/client/account" element={<MyAccount />} />
          <Route path="/client/payslips" element={<MyPayslips />} />
          <Route path="/client/payslips/:reportId" element={<PayslipPage />} />
          <Route path="/client/corrections" element={<MyCorrections />} />
        </Route>

        {/* UNKNOWN PAGES */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
