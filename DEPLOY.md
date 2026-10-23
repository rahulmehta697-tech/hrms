# Hosting a customer on Vercel and Neon, by hand

`scripts/new-customer.mjs` does all of this automatically (see [VENDOR-GUIDE.md](VENDOR-GUIDE.md)). Use these steps the first time, to understand what the script does, or if a step of the script fails.

> Use a **Vercel Pro** team for customers. The free Hobby plan is for personal, non-commercial projects only.

## 1. Create the Vercel project

1. In your Vercel team, **Add New → Project**, pick your `hrms` repository, and press **Import**.
2. Name it after the customer, e.g. `hrms-acme`. Don't deploy yet.

## 2. Add the database

1. In the project, **Storage → Create Database → Neon**. Pick the region closest to the customer.
2. Connect it for Production and Preview. Vercel adds `DATABASE_URL` and `DATABASE_URL_UNPOOLED`.
3. **Settings → Functions**: set the function region to the same area as the database.

## 3. Add environment variables

**Settings → Environment Variables:**

| Name | Value |
|---|---|
| `SETUP_KEY` | A long random phrase, used once on the first-run page |
| `LICENSE_KEY` | The customer's key from `node scripts/license.mjs issue …` (optional; it can also be pasted in the portal) |
| `PRODUCT_NAME`, `PRODUCT_URL`, `PRODUCT_SUPPORT` | Optional; defaults come from `src/lib/product.ts` |

## 4. Deploy and run setup

1. **Deployments → Redeploy.** The build creates the database tables before starting. A green build means it worked.
2. Open `https://hrms-acme.vercel.app` (or their domain, added under **Settings → Domains**).
3. On **Set up your HRMS**, enter the setup key, the organisation's name, short name, employee ID prefix and a Master Admin password. The Master Admin signs in with login ID `admin`.

`/api/health` shows whether the database is connected.

## 5. The customer's configuration

Everything starts empty. The Master Admin's **Setup checklist** lists each step with a link:

1. Organisation profile and logo; leave year; weekly off.
2. Licence key, if it wasn't set in step 3.
3. Master fields (type them in, or **Import** from the Excel template on each page):
   - Employee categories (each with an ID code: employee IDs look like `T-0001`)
   - Departments, Designations
   - Leave types
   - Shifts
   - Holidays
   - Attendance sources
   - Salary components
   - Onboarding checklist
4. **Attendance rules:** the date tracking starts, and an optional minimum attendance %.
5. **Employees → Import:** the full staff list. Re-importing updates people instead of duplicating them.
6. **Departments:** fill in each **Head (employee ID)**. Heads approve their department's requests.
7. **Users & passwords → Create logins:** done in batches of 200. Each batch downloads an Excel file of temporary passwords; staff choose their own at first sign-in. Set roles for HR, Accounts and Management users.
8. **Leave register → Opening balances**, and **Payroll → Salary structures**: import both from Excel.

### Salary components and payroll rules

Each salary component has a **Rule** that tells payroll how to treat it, whatever the customer calls it:

| Rule | Effect |
|---|---|
| Fixed amount | Paid or deducted as entered, reduced pro rata for loss-of-pay days (earnings only) |
| Basic pay | Paid like a fixed amount; also the base for PF |
| Auto: employee PF | 12% of basic pay, with basic capped at ₹15,000 |
| Auto: employer PF | Same calculation, shown as an employer contribution |
| Auto: employee ESI | 0.75% of gross when gross is ₹21,000 or less; adds employer ESI at 3.25% |
| Income tax (TDS) | A fixed monthly deduction, totalled separately in reports. Tax is not calculated automatically. |

In a salary structure, put the full-month amount for fixed components and `1` for Auto ones. Ask each customer's accounts team to compare the first two months against their current payroll, and to confirm the statutory rates are current.

## Monthly routine for the customer

- **Attendance:** import each device's punch file on **Attendance register → Import**. Duplicates are skipped.
- **Leave and regularisation:** staff apply; approvers act from **Approvals**.
- **Payroll:**
  1. Add inputs (arrears, deductions, `LOP days`).
  2. **Compute salaries**.
  3. HR marks it reviewed.
  4. Accounts approves.
  5. **Close and release payslips**.

## Backups and safety

- Neon keeps a restore history; check how far back the plan allows.
- Encourage each customer to export Employees, Leave register and the Payroll register monthly.
- Passwords are stored with bcrypt; sessions expire after the time set in the password policy.
- Every change is recorded in the **Change log**.

## Troubleshooting

| What you see | What to do |
|---|---|
| Build fails with `Migration failed` | Database variables are missing or wrong. Check them and redeploy. |
| Setup page says SETUP_KEY is not set | Add `SETUP_KEY` (8+ characters) and redeploy. |
| Someone is locked out | Master Admin → Users & passwords → **Unlock** or **Reset password**. |
| Master Admin password lost | In Neon's SQL editor: `DELETE FROM users WHERE login = 'ADMIN';`, then open `/setup` with the setup key. Only the admin login is recreated; all data stays. |
| “Licence expired” for staff | Issue a new key; the Master Admin pastes it in Settings → Licence. |
