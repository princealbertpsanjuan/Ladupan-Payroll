// Clean the database before going live.
//
// KEEPS:   admin accounts, Shop Network settings (+ employees with --keep-employees)
// DELETES: employee accounts, DTR / attendance (active + archived),
//          payroll reports (and therefore payslips), cash advances,
//          DTR correction requests, notifications, audit log
// RESETS:  the Employee ID counter (next employee continues after the
//          highest LDP-#### still in use, normally LDP-0001 or LDP-0002)
//
// Usage (from the backend folder):
//   npm run clean-db              -> preview only, nothing is deleted
//   npm run clean-db -- --confirm -> back up everything, then delete
//   (or: node scripts/cleanDatabase.js --confirm)
//
// Add --keep-employees to also KEEP employee accounts (their rates,
// schedules and registered phones). Only their records are deleted:
//   node scripts/cleanDatabase.js --keep-employees            (preview)
//   node scripts/cleanDatabase.js --keep-employees --confirm  (clean)
//
// A JSON backup of every collection is written to backend/backups/
// before anything is deleted (skip with --no-backup, not recommended).

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const User = require("../models/User");
const Attendance = require("../models/Attendance");
const PayrollReport = require("../models/PayrollReport");
const CashAdvance = require("../models/CashAdvance");
const CorrectionRequest = require("../models/CorrectionRequest");
const Notification = require("../models/Notification");
const AuditLog = require("../models/AuditLog");
const Counter = require("../models/Counter");
const Setting = require("../models/Setting");

const args = process.argv.slice(2);
// PowerShell can drop the "--" in `npm run clean-db -- --confirm`, so npm
// receives --confirm itself and passes it on as npm_config_confirm.
const CONFIRM = args.includes("--confirm") || process.env.npm_config_confirm === "true";
const KEEP_EMPLOYEES =
  args.includes("--keep-employees") || process.env.npm_config_keep_employees === "true";
const SKIP_BACKUP =
  args.includes("--no-backup") || process.env.npm_config_no_backup === "true";

const DELETE_ALL = [
  { label: "DTR / attendance records (active + archived)", model: Attendance },
  { label: "Payroll reports (and their payslips)", model: PayrollReport },
  { label: "Cash advance entries", model: CashAdvance },
  { label: "DTR correction requests", model: CorrectionRequest },
  { label: "Notifications", model: Notification },
  { label: "Audit log entries", model: AuditLog },
];

const backupDatabase = async () => {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const folder = path.join(__dirname, "..", "backups", `backup-${stamp}`);
  fs.mkdirSync(folder, { recursive: true });

  const models = [User, Attendance, PayrollReport, CashAdvance, CorrectionRequest, Notification, AuditLog, Counter, Setting];

  for (const model of models) {
    const docs = await model.find().lean();
    fs.writeFileSync(
      path.join(folder, `${model.collection.collectionName}.json`),
      JSON.stringify(docs, null, 2)
    );
  }

  return folder;
};

const main = async () => {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is missing. Run this from the backend folder with your .env in place.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  const dbName = mongoose.connection.name;

  const admins = await User.find({ role: "admin" }).select("employeeId firstName lastName email").lean();
  const employeeCount = await User.countDocuments({ role: { $ne: "admin" } });
  const settings = await Setting.findById("app").lean();

  console.log("");
  console.log(`Database: ${dbName}`);
  console.log("");
  console.log("KEEP");
  console.log(`  Admin accounts: ${admins.length}`);
  admins.forEach((admin) =>
    console.log(`    - ${admin.firstName} ${admin.lastName} <${admin.email}> ${admin.employeeId || ""}`)
  );
  if (KEEP_EMPLOYEES) {
    const kept = await User.find({ role: { $ne: "admin" } })
      .select("employeeId firstName lastName")
      .sort({ employeeId: 1 })
      .lean();
    console.log(`  Employee accounts: ${kept.length}`);
    kept.forEach((emp) => console.log(`    - ${emp.employeeId} ${emp.firstName} ${emp.lastName}`));
  }
  console.log(
    `  Shop Network settings: restriction ${settings?.restrictAttendanceNetwork ? "ON" : "OFF"}, ` +
      `${settings?.allowedNetworks?.length || 0} allowed network(s)`
  );
  (settings?.allowedNetworks || []).forEach((network) =>
    console.log(`    - ${network.address} (${network.label || "no label"})`)
  );

  console.log("");
  console.log("DELETE");
  if (!KEEP_EMPLOYEES) console.log(`  Employee accounts: ${employeeCount}`);
  for (const item of DELETE_ALL) {
    console.log(`  ${item.label}: ${await item.model.countDocuments()}`);
  }
  if (!KEEP_EMPLOYEES) console.log("  Employee ID counter: reset");
  console.log("");

  if (admins.length === 0) {
    console.error("Stopped: there is no admin account. Nothing was deleted (you would be locked out).");
    await mongoose.disconnect();
    process.exit(1);
  }

  if (!CONFIRM) {
    console.log("Preview only. Nothing was deleted.");
    console.log(
      `To clean the database, run:  node scripts/cleanDatabase.js${KEEP_EMPLOYEES ? " --keep-employees" : ""} --confirm`
    );
    await mongoose.disconnect();
    return;
  }

  if (!SKIP_BACKUP) {
    const folder = await backupDatabase();
    console.log(`Backup saved to: ${folder}`);
  }

  const results = [];

  if (!KEEP_EMPLOYEES) {
    const employees = await User.deleteMany({ role: { $ne: "admin" } });
    results.push(`Employee accounts deleted: ${employees.deletedCount}`);
  }

  for (const item of DELETE_ALL) {
    const result = await item.model.deleteMany({});
    results.push(`${item.label} deleted: ${result.deletedCount}`);
  }

  // The next Employee ID is recalculated from the accounts that remain
  if (!KEEP_EMPLOYEES) {
    await Counter.deleteOne({ _id: "employeeId" });
    results.push("Employee ID counter reset");
  }

  console.log("");
  results.forEach((line) => console.log(`  ✓ ${line}`));
  console.log("");
  console.log(
    KEEP_EMPLOYEES
      ? "Done. Admin accounts, employee accounts and Shop Network settings were kept."
      : "Done. Admin accounts and Shop Network settings were kept."
  );

  await mongoose.disconnect();
};

main().catch(async (error) => {
  console.error("Cleanup failed:", error.message);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
