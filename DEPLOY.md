# Deploying the HRMS

This guide takes you from the code in GitHub to a live portal your staff can sign in to. It uses the same setup as your attendance dashboard: **GitHub → Vercel → Neon Postgres**. Plan about an hour for steps 1–5, then the configuration in step 6 at your own pace.

> **Before real staff data goes in:** Vercel's free Hobby plan is meant for personal, non-commercial projects. Use it to set up and test, then move the project to a paid plan (Vercel Pro) before you load real salaries, bank details and personal data for your staff. Check the current terms on vercel.com/pricing.

---

## 1. Put the code in GitHub

The code lives in a **private** GitHub repository (for example `hrms`). Every push to the `main` branch redeploys the site automatically.

## 2. Create the Vercel project

1. Sign in at **vercel.com** with your GitHub account.
2. **Add New → Project**, pick the `hrms` repository, and press **Import**.
3. Vercel detects Next.js by itself. **Don't press Deploy yet**; first add the database and the setup key below.

## 3. Add the database (Neon)

1. In the new project open **Storage → Create Database → Neon** (Serverless Postgres).
2. Choose the region closest to your institute, and accept the free plan for now.
3. Connect it to the project for **Production, Preview and Development**. Vercel adds `DATABASE_URL` and `DATABASE_URL_UNPOOLED` for you.
4. Open **Settings → Functions** and set the function region to the same area as the database, so pages load quickly.

## 4. Add the setup key

**Settings → Environment Variables → Add**:

| Name | Value |
|---|---|
| `SETUP_KEY` | Any long random text, e.g. `Hrms-Setup-7f3K29xQ-2026`. Keep it private. |

The key is needed only once, on the first-run page. It stops anyone who finds the address from claiming the Master Admin login before you do.

## 5. Deploy and run first-time setup

1. **Deployments → Redeploy** (or push any change). The build creates all database tables before the site starts. A green build means it worked.
2. Open `https://<your-project>.vercel.app`. You land on **Set up your HRMS**.
3. Enter the setup key, the institute name, short name, employee ID prefix (e.g. `EMP` → logins like `EMP-F-1042`) and a Master Admin password.
4. You are signed in as **Master Admin**. Later you sign in with login ID `admin`.

Check the site health any time at `/api/health` (it should say `"db":"connected"`).

## 6. Configure, in this order

Everything below is done in the portal as Master Admin. Each list can be typed in, or filled from Excel with **Import** (every Import offers a template with an Instructions sheet).

1. **Institute profile**: logo, name, address, leave year (April–March or January–December), weekly off.
2. **Master fields**: check the starter lists and edit them to match your institute:
   - Employee categories (the ID code starts each employee ID: F, R, N, P, A, S…)
   - Departments, Designations
   - Leave types and yearly quotas
   - Shifts (start time and grace minutes decide late marks)
   - Holidays for the year
   - Attendance sources (AEBAS, face kiosks, RFID…)
   - Salary components
   - Onboarding checklist
3. **Attendance rules**: set **Track attendance from** to your go-live date, the minimum attendance % and which category it applies to.
4. **Employees → Import**: load your full employee list from Excel. Re-importing the same file later updates people instead of duplicating them.
5. **Master fields → Departments**: enter each department's **Head (employee ID)**. Heads approve their department's requests.
6. **Approval workflows**: who approves leave (short and long) and attendance regularisation.
7. **Users & passwords → Create logins**: creates logins in batches of 200 and downloads an Excel file of temporary passwords for each batch. Share each password privately; staff choose their own at first sign-in. Then set the right role for HR, Accounts and Management users in the same list.
8. **Roles & access**: confirm what each role can do. By default HR can export but only the Master Admin can import.
9. **Leave register → Opening balances → Import**: carry forward each person's balances from your old records.
10. **Payroll → Salary structures → Import**: one row per employee per component.

## 7. Daily and monthly routine

- **Attendance**: export each device's punches (for example the AEBAS daily file) and import them on **Attendance register → Import**. Columns: Employee ID, Date, Time, In / Out, Source. Duplicates are skipped, so re-importing a file is safe.
- **Leave and regularisation**: staff apply, approvers act from **Approvals**.
- **Payroll** (each month):
  1. Add variable inputs: arrears, one-off deductions, `LOP days`.
  2. **Compute salaries**.
  3. HR marks it reviewed.
  4. Accounts approves.
  5. **Close and release payslips**. Staff then see their payslips and can download them as PDF.

### How payroll calculates

- Earnings in the structure are monthly amounts, reduced pro rata for loss-of-pay days.
- **Provident fund**: add it to a structure (any amount, e.g. 1) and it is calculated as 12% of basic pay, capped at ₹15,000 basic. **Employer PF** works the same way.
- **ESI**: add it to a structure and it applies at 0.75% (employee) and 3.25% (employer) when gross pay is ₹21,000 or less.
- **Income tax (TDS)** is not calculated automatically. Put the monthly TDS amount in the structure, or as a monthly input.

Have your accounts team check the first two months' registers against your current payroll before relying on it, and confirm the statutory rates are still current.

## 8. Updating the HRMS

Push changes to `main` and Vercel redeploys. Database changes (new tables or columns) are applied automatically during the build, and existing data is kept.

## 9. Backups and safety

- Neon keeps a restore history; check how far back your plan allows under **Neon → Branches / Restore**.
- Once a month, also export Employees, Leave register and the Payroll register to Excel and keep them on the institute's drive.
- Passwords are stored encrypted (bcrypt). Sessions expire after the time set in **Users & passwords → Password policy**.
- Everything that changes data is recorded in **Change log**.

## 10. Troubleshooting

| What you see | What to do |
|---|---|
| Build fails with `Migration failed` | The database variables are missing or wrong. Check **Settings → Environment Variables**, then redeploy. |
| Setup page says SETUP_KEY is not set | Add `SETUP_KEY` (at least 8 characters) and redeploy. |
| `/api/health` shows `db` error | Neon may be paused or the connection string changed; open Neon and check the project is active. |
| Someone is locked out | Master Admin → Users & passwords → **Unlock** or **Reset password**. |
| Master Admin password forgotten | In Neon's SQL editor run `DELETE FROM users WHERE login = 'ADMIN';`, then sign in to `/setup` again with the setup key. Only the admin login is removed; all data stays. |
