# HRMS

A web-based HR system sold to organisations as one copy per customer: employee records, multi-source attendance, leave with approval workflows, payroll and payslips, recruitment and onboarding. Every employee signs in with their employee ID and password. Each customer starts with an empty system that their Master Admin configures through master fields, without code changes.

- **Selling and delivering:** [VENDOR-GUIDE.md](VENDOR-GUIDE.md) covers licences, the one-command setup for hosted customers, and updates.
- **Hosted customer, step by step:** [DEPLOY.md](DEPLOY.md)
- **Customer's own server (Docker):** [INSTALL-ONPREM.md](INSTALL-ONPREM.md)

## What's inside

| Who | What they get |
|---|---|
| Staff | Home dashboard, leave balance and applications, attendance calendar with every punch and its source, regularisation requests, payslips (PDF), change password |
| HOD | Approvals for their department, team attendance for any day |
| HR Office | Overview, employee records, attendance register (daily and monthly), leave register and opening balances, payroll runs, recruitment pipeline, one-time joining-form links for new joiners with document upload and HR verification, joining checklists, Excel/PDF export |
| Accounts / Management | Approval levels in workflows; Accounts approves payroll |
| Master Admin | Setup checklist, organisation profile and logo, licence, users and passwords, password policy, roles and access, approval workflows, attendance rules, nine master tables, change log, Excel import everywhere |

- **Attendance from any source**: AEBAS exports, face kiosks, RFID, and approved regularisations are merged into one daily record per person.
- **Import and export**: every data screen has Excel templates, a row-by-row preview with validation, and Excel/PDF export with the institute's name and logo.
- **Permissions**: a role/permission matrix controls who sees what; import and export are separate permissions.
- **Audit trail**: sign-ins, approvals, setting changes, imports and exports are logged.
- **Licensing**: signed licence keys set the customer name, employee limit and expiry; no key means a 25-employee demo.
- **Branding**: the customer's name and logo throughout, with your product name as “Powered by …”.

## Built with

Next.js 15 (App Router, server actions) · TypeScript · Drizzle ORM · PostgreSQL (Neon) · ExcelJS · jsPDF · bcrypt password hashing.

## Run it on your own computer

You need Node.js 20+ and a PostgreSQL database.

```bash
npm install
cp .env.example .env.local   # set DATABASE_URL and SETUP_KEY
npm run db:migrate
npm run dev                  # open http://localhost:3000 and complete setup
```

When you change `src/db/schema.ts`, run `npm run db:generate` to create a migration and commit the new file in `drizzle/`. Migrations run automatically on every deploy.

## Project layout

```
src/app/(app)/        signed-in pages (staff, HOD, HR, admin)
src/app/actions/      server actions that change data
src/app/api/          export, import, templates, payslip PDF, bulk logins, health
src/lib/config.ts     master field definitions, roles, permissions, defaults
src/lib/logic.ts      attendance, leave, approvals and payroll rules
src/lib/datasets.ts   every importable/exportable data set and its validation
src/lib/license.ts    licence checks;  src/lib/product.ts  your product brand
scripts/              migrate, license (issue keys), new-customer (provision hosted copies)
src/db/schema.ts      database tables
```
