# Institute HRMS

A web-based HR system for institutes and hospitals: employee records, multi-source attendance, leave with approval workflows, payroll and payslips, recruitment and onboarding. Every employee signs in with their employee ID and password; a Master Admin configures everything through master fields, without code changes.

**To put it live, follow [DEPLOY.md](DEPLOY.md).**

## What's inside

| Who | What they get |
|---|---|
| Staff | Home dashboard, leave balance and applications, attendance calendar with every punch and its source, regularisation requests, payslips (PDF), change password |
| HOD | Approvals for their department, team attendance for any day |
| HR Office | Overview, employee records, attendance register (daily and monthly), leave register and opening balances, payroll runs, recruitment pipeline, onboarding checklists, Excel/PDF export |
| Accounts / Management | Approval levels in workflows; Accounts approves payroll |
| Master Admin | Institute profile and logo, users and passwords, password policy, roles and access, approval workflows, attendance rules, nine master tables, change log, Excel import everywhere |

- **Attendance from any source**: AEBAS exports, face kiosks, RFID, and approved regularisations are merged into one daily record per person.
- **Import and export**: every data screen has Excel templates, a row-by-row preview with validation, and Excel/PDF export with the institute's name and logo.
- **Permissions**: a role/permission matrix controls who sees what; import and export are separate permissions.
- **Audit trail**: sign-ins, approvals, setting changes, imports and exports are logged.

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
src/db/schema.ts      database tables
```
