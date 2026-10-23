#!/usr/bin/env node
/**
 * Sets up a new hosted customer in one go:
 *   1. issues a licence key,  2. creates a Neon database,  3. creates a Vercel project from your GitHub repo
 *   with all environment variables,  4. starts the first deployment,  5. adds their web address (optional).
 *
 * Needs (in your shell or a .env.provision file):
 *   NEON_API_KEY      Neon → Account settings → API keys
 *   NEON_ORG_ID       only if your Neon key is a personal key (org keys don't need it)
 *   VERCEL_TOKEN      Vercel → Account settings → Tokens
 *   VERCEL_TEAM_ID    your Vercel team ID (Settings → General), if the projects live in a team
 *   GITHUB_REPO       e.g. yourname/hrms
 *   PRODUCT_NAME, PRODUCT_URL, PRODUCT_SUPPORT   optional, copied to the customer's project
 *
 * Usage:
 *   node scripts/new-customer.mjs --name "Acme Hospital" --slug acme --employees 500 --expires 2027-10-31 \
 *        [--domain hrms.acme.in] [--region aws-ap-southeast-1] [--dry-run]
 */
import { spawnSync } from "child_process";
import { randomBytes } from "crypto";
import fs from "fs";

if (fs.existsSync(".env.provision")) for (const l of fs.readFileSync(".env.provision", "utf8").split("\n")) { const m = /^\s*([A-Z_]+)\s*=\s*(.*)\s*$/.exec(l); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf("--" + k); return i >= 0 ? args[i + 1] : d; };
const dry = args.includes("--dry-run");
const name = opt("name"), slug = (opt("slug") || "").toLowerCase(), employees = opt("employees", "0"), expires = opt("expires"), domain = opt("domain"), region = opt("region", "aws-ap-southeast-1");
const die = (m) => { console.error("\n✗ " + m); process.exit(1); };
if (!name || !/^[a-z0-9-]{2,40}$/.test(slug) || !/^\d{4}-\d{2}-\d{2}$/.test(expires || "")) die('Usage: --name "Customer name" --slug short-id --employees 500 --expires 2027-10-31 [--domain hrms.example.in] [--dry-run]');
const env = process.env;
for (const k of ["NEON_API_KEY", "VERCEL_TOKEN", "GITHUB_REPO"]) if (!env[k] && !dry) die(`${k} is not set.`);
const project = `hrms-${slug}`;
const team = env.VERCEL_TEAM_ID ? `?teamId=${env.VERCEL_TEAM_ID}` : "";

async function call(url, method, body, token, soft = false) {
  if (dry) { console.log(`  [dry run] ${method} ${url}`); return {}; }
  const r = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = { raw: t }; }
  if (!r.ok) { const m = `${method} ${url} failed (${r.status}): ${t.slice(0, 400)}`; if (soft) throw new Error(m); die(m); }
  return j;
}

console.log(`Setting up ${name} (${project})${dry ? " — dry run, nothing is created" : ""}\n`);

// 1. Licence
console.log("1. Issuing licence key…");
const lic = spawnSync(process.execPath, ["scripts/license.mjs", "issue", "--customer", name, "--employees", employees, "--expires", expires], { encoding: "utf8" });
if (lic.status !== 0) die("Could not issue the licence: " + (lic.stderr || lic.stdout) + "\nRun `node scripts/license.mjs keygen` once first.");
const licenceKey = lic.stdout.trim();
console.log("   " + lic.stderr.trim());

// 2. Database
console.log("2. Creating Neon database…");
const neon = await call("https://console.neon.tech/api/v2/projects", "POST", { project: { name: project, region_id: region, pg_version: 16, ...(env.NEON_ORG_ID ? { org_id: env.NEON_ORG_ID } : {}) } }, env.NEON_API_KEY);
const cu = neon.connection_uris?.[0];
const direct = cu?.connection_uri || "postgres://DRY-RUN";
const pooledHost = cu?.connection_parameters?.pooler_host;
const pooled = pooledHost ? direct.replace(cu.connection_parameters.host, pooledHost) : direct.replace(/@(ep-[^.]+)\./, "@$1-pooler.");
console.log(`   Neon project ${neon.project?.id || "(dry run)"} in ${region}`);

// 3. Vercel project with environment variables
console.log("3. Creating Vercel project…");
const setupKey = randomBytes(18).toString("base64url");
const targets = ["production", "preview"];
const vars = { DATABASE_URL: pooled, DATABASE_URL_UNPOOLED: direct, SETUP_KEY: setupKey, LICENSE_KEY: licenceKey, PRODUCT_NAME: env.PRODUCT_NAME, PRODUCT_URL: env.PRODUCT_URL, PRODUCT_SUPPORT: env.PRODUCT_SUPPORT };
const environmentVariables = Object.entries(vars).filter(([, v]) => v).map(([key, value]) => ({ key, value, target: targets, type: "encrypted" }));
const vp = await call(`https://api.vercel.com/v11/projects${team}`, "POST", { name: project, framework: "nextjs", gitRepository: { type: "github", repo: env.GITHUB_REPO }, environmentVariables }, env.VERCEL_TOKEN);
console.log(`   Vercel project ${vp.id || "(dry run)"}`);

// 4. First deployment
console.log("4. Starting the first deployment…");
const [org, repo] = (env.GITHUB_REPO || "owner/repo").split("/");
let deployed = true;
try { await call(`https://api.vercel.com/v13/deployments${team}`, "POST", { name: project, project: vp.id || project, target: "production", gitSource: { type: "github", org, repo, ref: "main" } }, env.VERCEL_TOKEN, true); }
catch (e) { deployed = false; console.log("   " + e.message); }

// 5. Domain
if (domain) {
  console.log(`5. Adding ${domain}…`);
  await call(`https://api.vercel.com/v10/projects/${encodeURIComponent(vp.id || project)}/domains${team}`, "POST", { name: domain }, env.VERCEL_TOKEN);
}

const url = domain ? `https://${domain}` : `https://${project}.vercel.app`;
const record = { name, slug, project, url, region, licence: licenceKey, setupKey, employees: Number(employees), expires, created: new Date().toISOString().slice(0, 10) };
if (!dry) { fs.mkdirSync("customers", { recursive: true }); fs.writeFileSync(`customers/${slug}.json`, JSON.stringify(record, null, 2), { mode: 0o600 }); }

console.log(`
✓ ${name} is set up${dry ? " (dry run)" : ""}.

  Address:     ${url}
  Setup key:   ${setupKey}
  Licence:     ${employees === "0" ? "unlimited" : employees} employees until ${expires}
${deployed ? "" : "\n  The first deployment didn't start automatically: open the project in Vercel and press Deploy.\n"}${domain ? `
  Ask the customer's IT team to add this DNS record:  ${domain}  CNAME  cname.vercel-dns.com
` : ""}
  Next: open the address, enter the setup key, and create their Master Admin.
${dry ? "" : `  A copy of these details is in customers/${slug}.json (keep it private; it is not in git).`}`);
