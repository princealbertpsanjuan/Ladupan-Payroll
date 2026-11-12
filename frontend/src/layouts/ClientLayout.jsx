import AppShell from "../components/AppShell";

const CLIENT_NAV = [
  { to: "/client/dashboard", label: "Dashboard", icon: "dashboard" },
  { to: "/client/time", label: "Time In / Out", icon: "clock" },
  { to: "/client/records", label: "My Records", icon: "records" },
  { to: "/client/corrections", label: "DTR Corrections", icon: "edit" },
  { to: "/client/payslips", label: "My Payslips", icon: "receipt" },
  { to: "/client/archives", label: "My Archives", icon: "archive" },
  { to: "/client/account", label: "My Account", icon: "user" },
];

const ClientLayout = () => <AppShell navItems={CLIENT_NAV} subtitle="Employee Portal" />;

export default ClientLayout;
