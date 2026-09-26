# Urgent Billing

GST billing and invoicing app for an IT services business. It covers invoices, payments, credit notes, domain and hosting renewals, vendor bills and expenses, with automatic payment reminders.

- **Backend:** Node.js, Express 5, MySQL 8 (`backend/`)
- **Frontend:** React 19, Vite, Tailwind CSS (`frontend/`)

## Features

| Area | What it does |
|---|---|
| Invoices | DRAFT → FINAL workflow, GST (CGST+SGST or IGST), monthly/period billing, gapless numbering (`UIS/2026-27/000001`), PDF with UPI QR code |
| Payment plans | Project value split into installments (e.g. 30/40/30, by % or amount) with due dates or "on completion". Per installment: payment request / demand letter PDF (`UDL/...`, schedule, GST, UPI QR), email or WhatsApp, and a one-click GST tax invoice. Optional daily automation: demand before the due date, reminder when overdue, tax invoice on the due date. |
| Payments | Partial/full payments, receipt PDF, delete a wrong payment (ADMIN, audited) |
| Credit notes | Against FINAL invoices, full or partial (per line), optional refund, own number series (`UCN/2026-27/000001`), PDF |
| Sending | Email invoice with PDF attached; WhatsApp message with invoice summary |
| Online payment | Razorpay payment link per invoice ("Pay Now"). The invoice is marked paid automatically by webhook, by the customer returning to the portal, or by a sync every 30 minutes. |
| Customer portal | A secret link per customer (no password) to see invoices, download PDFs, view the account statement and pay online |
| Automation | Daily at 9 AM IST: overdue payment reminders (e.g. 3/7/15 days), renewal auto-invoice (DRAFT), renewal expiry alerts |
| Renewals | Domain/hosting/SSL/AMC renewals with due-date tracking |
| Vendors | Vendor services, daily consumption, monthly vendor bills and payments |
| Reports | Dashboard (sales, GST, dues, aging, profit), customer ledger, Excel/PDF export |
| GST | GSTIN check (format + check digit), HSN/SAC check, place of supply picked from the customer (GSTIN state first) with IGST vs CGST+SGST decided automatically, GSTR-1 Excel (b2b, b2cl, b2cs, cdnr, cdnur, hsn(b2b), hsn(b2c), docs, plus a warnings sheet) |
| Profit & Loss | Month-wise income (taxable sales − credit notes) minus expenses, vendor bills and renewal payments; Excel export |
| Users | Roles: `ADMIN`, `STAFF`, `VIEWER` |

## Requirements

- Node.js 20 or newer
- MySQL 8.0 or newer
- Chrome is downloaded automatically by Puppeteer on `npm install`. It is used to make PDFs.

## Setup (new machine)

```bash
# 1) Backend config
cd backend
cp .env.example .env          # then edit .env: DB_*, JWT_SECRET, SMTP_*
npm install

# 2) Database: creates the DB, loads database/schema.sql, applies migrations
npm run db:init

# 3) First login
npm run create-admin -- --email admin@example.com --password "Secret@123" --name "Admin" --company "My Company Pvt Ltd"

# 4) Run the API (http://localhost:5000)
npm run dev

# 5) Frontend (http://localhost:5173), in a second terminal
cd ../frontend
npm install
npm run dev
```

Log in with the admin account, then fill in **Company Settings**: GSTIN, address, bank details, and a UPI ID in `name@bank` form (needed for the QR code). Then go to **Reminders & Alerts** to switch on automation.

## Configuration (`backend/.env`)

| Variable | Purpose |
|---|---|
| `PORT` | API port (default 5000) |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME` | MySQL connection |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Login tokens. Use a long random secret. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Outgoing email. For Gmail use `smtp.gmail.com`, port 587 and an App Password. |
| `PUBLIC_APP_URL` | Public URL of the frontend, e.g. `https://billing.example.com`. Needed for portal links in emails/WhatsApp and for the Razorpay return page. |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Razorpay API keys (Dashboard → Account & Settings → API Keys). Use test keys first. |
| `RAZORPAY_WEBHOOK_SECRET` | Secret of the Razorpay webhook. Webhook URL: `<API URL>/api/webhooks/razorpay`, event `payment_link.paid`. |
| `NOTIFY_CRON` | When the daily automation runs (default `0 9 * * *`, Asia/Kolkata) |
| `DISABLE_CRON` | Set to `1` to turn the daily automation off, e.g. on a second server |

Frontend: set `VITE_API_URL` (for example in `frontend/.env`) when the API is not at `http://localhost:5000`.

## Database changes

- `backend/database/schema.sql` is the full current schema. Use it only for a new, empty database.
- Changes go in `backend/migrations/NNN_description.sql`. Each file runs once and is recorded in `schema_migrations`.
- After pulling new code on an existing install, run:

```bash
cd backend
npm run migrate
```

## Scripts (backend)

| Command | What it does |
|---|---|
| `npm run dev` | API with auto-restart (nodemon) |
| `npm start` | API (production) |
| `npm run db:init` | Create DB + load schema + migrate (safe to re-run) |
| `npm run migrate` | Apply new migrations |
| `npm run create-admin -- --email ... --password ...` | Create an ADMIN user (and the company if none exists) |

## Project structure

```
backend/
  src/
    app.js, server.js        Express app; server starts the daily scheduler
    config/                  env + MySQL pool
    middlewares/             auth (JWT + role check), errors, uploads
    modules/<name>/          routes → controller → service → repository
    modules/pdf/templates/   invoice / receipt / credit note HTML for PDFs
    jobs/scheduler.js        daily reminders & renewal automation
    utils/                   mailer, UPI QR, audit log, ownership checks
  database/schema.sql
  migrations/
  scripts/
frontend/
  src/
    api/                     axios calls per module
    pages/                   screens
    components/              layout + UI components
```

## Notes

- A FINAL invoice cannot be edited or cancelled. Correct it with a credit note.
- A demand letter is a payment request, not a tax invoice. For installments with a fixed due date, GST expects the tax invoice by that date: create it from the plan, or switch on "auto invoice" in Reminders & Alerts.
- GSTR-1 includes FINAL invoices and credit notes dated in the month. B2CL is inter-state B2C invoices above ₹1,00,000. Check the `warnings` sheet and have your CA review the file before filing.
- Invoice balance is `grand total − credit notes − payments + refunds`.
- The customer portal only shows invoices that are FINAL or were sent to the customer. Use **Regenerate** on a customer's portal link to stop the old link from working.
- Razorpay webhooks need the API to be reachable from the internet. Without that, payments are still picked up by the 30-minute sync or when the customer returns to the portal.
- `backend/uploads/` (logo, signature) and `backend/.env` are not committed. Back them up separately.
