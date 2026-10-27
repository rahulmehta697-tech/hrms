# Vendor guide: selling and delivering the HRMS

You sell one copy of the HRMS per organisation. Each copy has its own database, its own web address (or its own server) and its own licence key. All copies are built from your one GitHub repository.

| | Hosted by you | On the customer's server |
|---|---|---|
| Where it runs | Vercel + Neon, on your accounts | Their Linux server, with Docker |
| Set up with | `scripts/new-customer.mjs` (a few minutes) | [INSTALL-ONPREM.md](INSTALL-ONPREM.md), run by their IT team or you |
| Updates | Automatic on every push to `main` | You send a new version; they run one command |
| You charge | Subscription (setup fee + monthly/yearly) | Licence fee + annual support |

---

## One-time preparation (done once, before your first sale)

1. **Product name.** Set your brand in `src/lib/product.ts` (`name`, `url`, `support`), commit and push. It appears as “Powered by …” on the sign-in page, at the bottom of every screen, and on every Excel and PDF file. You can also override it per deployment with the `PRODUCT_NAME`, `PRODUCT_URL` and `PRODUCT_SUPPORT` environment variables.
2. **Licence signing key.** This is already generated. The public half is in `src/lib/license-public.ts` (committed). The private half is the file `licence-private.pem`, which you received separately.
   - Keep it in `licence-keys/licence-private.pem` inside your local copy of the code. That folder is excluded from git.
   - Back it up somewhere safe, such as an encrypted USB drive or a password manager.
   - If you lose it, you cannot issue renewals that existing installations accept.
   - If someone else gets it, they can issue licences themselves.
3. **Accounts for hosting:** GitHub (the private repo), a **Vercel Pro** team (commercial use isn't allowed on the free Hobby plan) and a **Neon** account.
4. **Node.js 20+** on your computer, to run the licence and provisioning scripts.

## Issuing a licence key

```bash
node scripts/license.mjs issue --customer "Acme Hospital" --employees 500 --expires 2027-10-31
```

- The command prints a key starting with `HRMS1.`.
- `--employees 0` means unlimited employees. `--grace 15` (the default) keeps the portal working for 15 days after expiry.
- Check any key with `node scripts/license.mjs verify <key>`.

**What the licence controls in the app:**

| Situation | What happens |
|---|---|
| No key (demo mode) | Everything works, up to 25 employees. Use this for demos and trials. |
| Valid key | Works up to the licensed number of active employees. The Master Admin sees a warning at 90% of the limit. |
| Within 30 days of expiry | The Master Admin sees a renewal warning. |
| Expired, inside the grace period | Everyone sees a warning; everything still works. |
| Expired, past the grace period | Only the Master Admin can sign in, to enter a new key. Staff see a “licence expired” page. |
| Tampered or fake key | Rejected; the installation stays in demo mode. |

Renewing or upgrading means issuing a new key. The customer's Master Admin pastes it in **Settings → Licence**, or you update `LICENSE_KEY` in their hosting settings.

Employees marked **Exited** don't count towards the limit.

> The licence check discourages over-use. It cannot stop someone who has the source code and edits it. For on-premise customers, the licence agreement you sign with them is the real protection.

## Selling a hosted customer

1. Create a file named `.env.provision` in your code folder (it is excluded from git):
   ```
   NEON_API_KEY=...        # Neon → Account settings → API keys
   NEON_ORG_ID=...         # only needed with a personal Neon API key
   VERCEL_TOKEN=...        # Vercel → Account settings → Tokens
   VERCEL_TEAM_ID=...      # Vercel team → Settings → General
   GITHUB_REPO=yourname/hrms
   ```
2. Try it without creating anything:
   ```bash
   node scripts/new-customer.mjs --name "Acme Hospital" --slug acme --employees 500 --expires 2027-10-31 --domain hrms.acmehospital.in --dry-run
   ```
3. Run the same command without `--dry-run`. It will:
   1. issue the licence;
   2. create a Neon database;
   3. create a Vercel project linked to your repo, with the database, setup key, licence and product name already set;
   4. start the first deployment;
   5. add their domain.
4. It prints the address, the **setup key** and the DNS record their IT team must add. A copy is saved in `customers/acme.json`, which is excluded from git; keep it private.
5. Open the address, enter the setup key, the organisation's name and a Master Admin password. Then hand the Master Admin login to the customer, or do the setup with them.

The first time you run it, check the new project in Vercel's dashboard. If any step fails (for example, Vercel needs your GitHub account connected first), the script says which call failed. You can finish that step by hand as described in [DEPLOY.md](DEPLOY.md).

## Selling an on-premise customer

1. Issue a licence key (above).
2. Give their IT team the code and [INSTALL-ONPREM.md](INSTALL-ONPREM.md). Either share read access to your private GitHub repo, or send a zip of the repository without the `licence-keys` and `customers` folders.
3. They set the licence key, a database password and a setup key in `.env`, then run `docker compose up -d`.

## After every sale

New installations start **empty**. The customer's Master Admin sees a **Setup checklist** that walks through each step: organisation profile, licence, the nine master lists, attendance rules, importing employees, heads of department and logins. Every list can be typed in or imported from Excel using the templates in the app.

## Shipping updates

- **Hosted customers:** push to `main`. Every customer's Vercel project redeploys, and database changes apply automatically during the build.
- **On-premise customers:** send the new code. They run `docker compose up -d --build`, and database changes apply when the container starts. Data is kept.
- Before pushing, run the app against a copy of real data (for example, a Neon branch) so a bad update doesn't reach every customer at once.

## Your demo copy

One deployment with `DEMO_MODE=1` is your shop window. Prospects try it, and when one buys you give them a clean copy (above).

- **Sample data:** it fills itself with a fictional "Demo Institute of Medical Sciences":
  - about 110 employees;
  - two months of attendance from three sources;
  - leave in every state;
  - last month's payroll closed with payslips;
  - recruitment and onboarding in progress.

  All dates are relative to today, so it always looks current.
- **Sign-in:** the sign-in page lists five demo accounts (Master Admin, HR Office, Head of department, Accounts, Staff) with one-click sign-in. Every account uses the password `Demo@1234`.
- **Reset:** the data resets every night at 2:00 AM IST through Vercel Cron (`vercel.json`). The Master Admin can also press **Reset demo data now** before a meeting.
- **Guard rails:**
  - password changes and the password policy are switched off;
  - wrong passwords never lock an account;
  - the five demo accounts can't be disabled or reset;
  - the licence can't be changed.

**Environment variables for the demo project:**

| Name | Value |
|---|---|
| `DATABASE_URL` / `DATABASE_URL_UNPOOLED` | Added by Vercel's Neon integration |
| `DEMO_MODE` | `1` |
| `CRON_SECRET` | Any long random text; Vercel sends it to the nightly reset |
| `LICENSE_KEY` | A demo key, e.g. `node scripts/license.mjs issue --customer "Demo Institute of Medical Sciences" --employees 500 --expires 2028-12-31` |

Never set `DEMO_MODE` on a customer's copy: it wipes the database every night.
