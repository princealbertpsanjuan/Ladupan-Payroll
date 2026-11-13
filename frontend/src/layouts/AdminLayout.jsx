import AppShell from "../components/AppShell";

const ADMIN_NAV = [
  { to: "/admin/dashboard", label: "Dashboard", icon: "dashboard" },
  { to: "/admin/employees", label: "Employees", icon: "users" },
  { to: "/admin/attendance", label: "Attendance", icon: "clock" },
  { to: "/admin/corrections", label: "DTR Corrections", icon: "edit" },
  { to: "/admin/payroll", label: "Payroll", icon: "payroll" },
  { to: "/admin/cash-advances", label: "Cash Advances", icon: "cash" },
  { to: "/admin/reports", label: "Reports", icon: "report" },
  { to: "/admin/archives", label: "Archives", icon: "archive" },
  { to: "/admin/audit-log", label: "Audit Log", icon: "shield" },
  { to: "/admin/settings", label: "Shop Network", icon: "wifi" },
  { to: "/admin/account", label: "My Account", icon: "user" },
];

const AdminLayout = () => <AppShell navItems={ADMIN_NAV} subtitle="Admin Panel" />;

export default AdminLayout;
