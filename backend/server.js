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


const app = express();

app.use(cors());
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