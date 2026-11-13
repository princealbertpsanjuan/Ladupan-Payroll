const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const authRoutes = require("./routes/authRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const employeeRoutes = require("./routes/employeeRoutes");
const payrollRoutes = require("./routes/payrollRoutes");
const reportRoutes = require("./routes/reportRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const payslipRoutes = require("./routes/payslipRoutes");
const correctionRoutes = require("./routes/correctionRoutes");
const cashAdvanceRoutes = require("./routes/cashAdvanceRoutes");
const auditLogRoutes = require("./routes/auditLogRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const notificationRoutes = require("./routes/notificationRoutes");


const app = express();

// Which client IP to trust (used by the shop network restriction).
// - Not set (default): use the direct connection's address. Correct when
//   the backend runs on a shop computer or is reached directly.
// - Hosted behind a proxy (Render, Railway, Nginx): set TRUST_PROXY=1 so
//   the real visitor IP from the proxy is used.
// Never trust X-Forwarded-For blindly: anyone could fake the shop's IP.
if (process.env.TRUST_PROXY) {
  const value = process.env.TRUST_PROXY;
  app.set("trust proxy", /^\d+$/.test(value) ? Number(value) : value);
}

// Only the deployed frontend may call the API. FRONTEND_URL can list
// several origins separated by commas. When it is not set (local
// development), every origin is allowed.
const allowedOrigins = (process.env.FRONTEND_URL || "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

app.use(
  cors(
    allowedOrigins.length > 0
      ? {
          origin: (origin, callback) => {
            // Requests without an Origin (curl, health checks) are allowed
            if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
            return callback(null, false);
          },
        }
      : undefined
  )
);
app.use(express.json());

// Express 5 leaves req.body undefined when a request has no JSON body
app.use((req, res, next) => {
  if (req.body === undefined) req.body = {};
  next();
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/payroll", payrollRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/payslips", payslipRoutes);
app.use("/api/corrections", correctionRoutes);
app.use("/api/cash-advances", cashAdvanceRoutes);
app.use("/api/audit-logs", auditLogRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/notifications", notificationRoutes);



app.get("/", (req, res) => {
  res.send("Ladupan Payroll API Running");
});

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log(err));

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});