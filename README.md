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
| `TRUST_PROXY`  | Only if the backend is hosted behind a proxy (Render, Railway, Nginx): set to `1`. Leave unset otherwise. |

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

### 4. Clean the database before going live

Removes all test data but **keeps admin accounts and Shop Network settings**:
employees, DTR (active and archived), payroll reports/payslips, cash
advances, correction requests, notifications, and the audit log are deleted,
and Employee IDs restart after the highest one still in use.

```bash
cd backend
npm run clean-db               # preview: shows what would be deleted
npm run clean-db -- --confirm  # backs up to backend/backups/, then deletes
```

The backup folder holds passwords (hashed) and salary data. It is ignored by
git; keep it private and delete it once you no longer need it.

## Deployment (Render + Vercel + MongoDB Atlas)

**Backend on Render** (Web Service): root directory `backend`, build command
`npm install`, start command `npm start`. Environment variables:

| Variable | Value |
| --- | --- |
| `MONGO_URI` | Atlas connection string |
| `JWT_SECRET` | long random string |
| `FRONTEND_URL` | your Vercel address, e.g. `https://ladupan-payroll.vercel.app` |
| `CLIENT_IP_HEADER` | `true-client-ip` (real visitor IP for the shop network check) |
| `APP_TIMEZONE` | `Asia/Manila` |

**Frontend on Vercel**: root directory `frontend`, framework Vite. Environment
variable `VITE_API_URL` = `https://<your-render-service>.onrender.com/api`.
`frontend/vercel.json` makes page refreshes on routes like `/admin/payroll` work.

**Atlas**: Network Access must allow Render to connect (`0.0.0.0/0`, since
Render's free plan has no fixed IP).

After deploying, open Shop Network at each shop and check that "Connected
from" matches the shop's public IP (search "what is my ip" on the same Wi-Fi).

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

### Shop network (Time In / Time Out only on the shop Wi-Fi)

1. On a device connected to the **shop Wi-Fi**, sign in as admin and open
   **Shop Network**.
2. Click **Add this network**. This saves the shop's IP address as you see it.
3. Turn the switch **ON**.

From then on, employees can Time In / Time Out only from that network. Viewing
records, payslips, and corrections still works from anywhere. Attempts from
other networks are blocked, written to the Audit Log, and the admin gets a
notification (at most one per employee every 15 minutes).

- If the backend runs **on a shop computer**, employees reach it through the
  shop's local network, so add the local range instead, e.g. `192.168.1.0/24`
  (the "Add this network" button shows the address the server sees).
- **More than one shop:** add each shop's network (do "Add this network" once
  at each shop, and give each a name like "Main branch").
- **IPv6:** many providers (e.g. PLDT) also give IPv6 addresses, and devices
  use temporary IPv6 addresses that change daily. "Add this network" saves the
  shop's whole IPv6 network (`/64`) so every device at the shop is covered.
- If the backend is **hosted online**, the shop's public IP is what counts.
  Most providers can change it (for example after a router restart). If
  employees suddenly can't time in at the shop, add the network again.
- Behind a hosting proxy, set `TRUST_PROXY=1`, otherwise every visitor looks
  like the proxy's address. Do not set it when there is no proxy, or someone
  could fake the shop's address.

### Notifications

The bell in the sidebar shows in-app notifications (checked every 30 seconds
and when you return to the tab; new ones also pop up as a toast).

- **Admin:** blocked time in/out attempts outside the shop, new DTR correction
  requests.
- **Employee:** payslip ready, DTR correction approved/rejected, the admin
  added/edited/deleted their DTR (including a changed required time-in), cash
  advance recorded.

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
