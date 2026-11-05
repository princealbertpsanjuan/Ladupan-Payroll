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

function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* LOGIN */}
        <Route
          path="/"
          element={<Login />}
        />

        {/* ADMIN ROUTES */}
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute allowedRole="admin">
              <AdminLayout>
                <Dashboard />
              </AdminLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/employees"
          element={
            <ProtectedRoute allowedRole="admin">
              <AdminLayout>
                <Employees />
              </AdminLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/attendance"
          element={
            <ProtectedRoute allowedRole="admin">
              <AdminLayout>
                <Attendance />
              </AdminLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/payroll"
          element={
            <ProtectedRoute allowedRole="admin">
              <AdminLayout>
                <Payroll />
              </AdminLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/reports"
          element={
            <ProtectedRoute allowedRole="admin">
              <AdminLayout>
                <Reports />
              </AdminLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/archives"
          element={
            <ProtectedRoute allowedRole="admin">
              <AdminLayout>
                <Archives />
              </AdminLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/corrections"
          element={
            <ProtectedRoute allowedRole="admin">
              <AdminLayout>
                <Corrections />
              </AdminLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/cash-advances"
          element={
            <ProtectedRoute allowedRole="admin">
              <AdminLayout>
                <CashAdvances />
              </AdminLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/audit-log"
          element={
            <ProtectedRoute allowedRole="admin">
              <AdminLayout>
                <AuditLog />
              </AdminLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/payslip/:reportId/:employeeId"
          element={
            <ProtectedRoute allowedRole="admin">
              <AdminLayout>
                <PayslipPage admin />
              </AdminLayout>
            </ProtectedRoute>
          }
        />

        {/* CLIENT ROUTES */}
        <Route
          path="/client/dashboard"
          element={
            <ProtectedRoute allowedRole="employee">
              <ClientLayout>
                <ClientDashboard />
              </ClientLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/client/time"
          element={
            <ProtectedRoute allowedRole="employee">
              <ClientLayout>
                <TimeInOut />
              </ClientLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/client/records"
          element={
            <ProtectedRoute allowedRole="employee">
              <ClientLayout>
                <MyRecords />
              </ClientLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/client/archives"
          element={
            <ProtectedRoute allowedRole="employee">
              <ClientLayout>
                <MyArchives />
              </ClientLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/client/account"
          element={
            <ProtectedRoute allowedRole="employee">
              <ClientLayout>
                <MyAccount />
              </ClientLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/client/payslips"
          element={
            <ProtectedRoute allowedRole="employee">
              <ClientLayout>
                <MyPayslips />
              </ClientLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/client/payslips/:reportId"
          element={
            <ProtectedRoute allowedRole="employee">
              <ClientLayout>
                <PayslipPage />
              </ClientLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/client/corrections"
          element={
            <ProtectedRoute allowedRole="employee">
              <ClientLayout>
                <MyCorrections />
              </ClientLayout>
            </ProtectedRoute>
          }
        />

        {/* UNKNOWN PAGES */}
        <Route path="*" element={<Navigate to="/" />} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;