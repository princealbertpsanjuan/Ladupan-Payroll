# Ladupan Payroll Management System

MERN payroll system with Daily Time Record (DTR) for Ladupan: attendance
monitoring, payroll computation, payslips, cash advances, DTR corrections,
employee management, payroll archiving, and an audit log.

| Part     | Technology                         |
| -------- | ---------------------------------- |
| Database | MongoDB Atlas (Mongoose)           |
| Backend  | Node.js, Express, JWT, bcrypt      |
| Frontend | React (Vite), React Router, Axios  |

## Setup

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env   # then fill in the values
npm run dev            # or: npm start
```

`.env` values:

| Variable       | Description                                              |
| -------------- | -------------------------------------------------------- |
| `MONGO_URI`    | MongoDB Atlas connection string                          |
| `JWT_SECRET`   | Long random string used to sign login tokens             |
| `PORT`         | API port (default `5000`)                                |
| `APP_TIMEZONE` | Attendance timezone (default `Asia/Manila`)              |

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

If the backend is not at `http://localhost:5000/api`, create `frontend/.env`:

```
VITE_API_URL=https://your-backend-host/api
```

### 3. Create the owner (admin) account

Registration is open **only while the system has no admin**. Create the
owner account once:

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Owner","lastName":"Name","email":"owner@example.com","password":"change-me"}'
```

After that, `/api/auth/register` is closed, and employee accounts are created by
the admin in **Employee Management**.

## Rules

### Attendance

- Employees can Time In once per day and Time Out once per day, only after timing in.
- Dates and times use Philippine time (`Asia/Manila`), whatever the server's timezone.
- Remarks are calculated automatically from the admin-set required time-in:

| Remarks | Condition                                         |
| ------- | ------------------------------------------------- |
| Present | Time-in on or before required time                |
| Late    | After required time, less than 90 minutes late    |
| Absent  | 90 minutes late or more → 0 hours, ₱0 gross pay   |

- **Schedule changes for one day:** when an employee's required time-in is
  different on a particular day, the admin edits that day's DTR in Attendance
  Management and sets **Required Time In (this day)**. Remarks, hours, and pay
  recalculate for that day only; the employee's default schedule in Employee
  Management stays the same. Such days are tagged "adjusted", and the change is
  written to the Audit Log.
- **Paid hours count from the actual time-in to time-out.** Lateness already
  reduces paid hours, so no separate late deduction is charged. Late minutes are
  still recorded and shown.
- A record with a time-in but no time-out is flagged **No time-out**. The admin
  sets the time-out in Attendance Management, or the employee sends a DTR
  correction request. Until then it counts as 0 hours.

### Payroll

```
Gross Pay  = Total Hours × Hourly Rate
Net Salary = Gross Pay − Cash Advance − Other Deductions
```

1. The admin picks a start date, an end date, and **specific employees**.
2. **Preview Payroll** shows hours and gross pay. The admin enters cash advance
   and other deductions here. A cash advance deduction can't exceed the
   employee's unpaid balance.
3. If any DTR in the period has no time-out, the admin must fix it first or
   confirm to include it as 0 hours.
4. **Generate Payroll** saves the report, creates payslips, records the cash
   advance repayments, and archives **only the selected employees' DTR records
   in that period**.

## Features

**Admin:** Dashboard (real counts only), Employee Management (auto Employee ID
`LDP-0001`, edit, password reset, activate/deactivate, delete), Attendance
Management, DTR Corrections, Payroll Generation, Cash Advances, Payroll Reports
with payslips, Archives, Audit Log.

**Employee:** Dashboard, Time In / Out, My Records, DTR Corrections, My
Payslips (printable / Save as PDF), My Archives, My Account (change password).

### Safety rules

- Archived DTR records are locked (they belong to a generated payroll).
- Deactivated accounts lose access immediately.
- An employee can't be deleted while they have unpaid DTR records, pending
  corrections, or an unpaid cash advance. Deactivate them instead. Their
  remaining DTR days can still be paid by ticking them in Payroll Generation.
- Every admin change (and each correction request) is written to the Audit Log.

## API overview

| Area         | Endpoints                                                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth         | `POST /api/auth/register` (first admin only), `POST /api/auth/login`, `GET /api/auth/me`, `PUT /api/auth/change-password`                         |
| Employees    | `GET /api/employees`, `POST /api/employees/create`, `PUT /api/employees/:id`, `DELETE /api/employees/:id`                                         |
| Attendance   | `POST /time-in`, `PUT /time-out`, `GET /today`, `GET /my-records`, `GET /my-archives`; admin: `GET /`, `POST /`, `PUT /:id`, `DELETE /:id`        |
| Payroll      | `POST /api/payroll/preview`, `POST /api/payroll/generate`                                                                                         |
| Reports      | `GET /api/reports/payroll`, `GET /api/reports/payroll/:id`, `GET /api/reports/archives`                                                           |
| Payslips     | `GET /api/payslips/my`, `GET /api/payslips/my/:reportId`, `GET /api/payslips/:reportId/:employeeId` (admin)                                       |
| Corrections  | `POST /api/corrections`, `GET /api/corrections/my`, `DELETE /api/corrections/my/:id`; admin: `GET /api/corrections`, `PUT /:id/approve`, `PUT /:id/reject` |
| Cash advance | `GET /api/cash-advances/my`; admin: `GET /api/cash-advances`, `GET /employee/:employeeId`, `POST /`, `DELETE /:id`                                |
| Audit log    | `GET /api/audit-logs` (admin)                                                                                                                     |
| Dashboard    | `GET /api/dashboard/admin`, `GET /api/dashboard/employee`                                                                                         |
