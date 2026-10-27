"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireAdmin, requirePerm, hashPassword, tempPassword, who } from "@/lib/auth";
import { getSettings, saveSetting, getMasters } from "@/lib/settings";
import { APPROVERS, PERM_KEYS, ROLE_KEYS, ROLES, WEEKOFF_OPTIONS, masterDef, type Access, type Role } from "@/lib/config";
import { isDate, isTime } from "@/lib/dates";
import { log } from "@/lib/audit";
import { DEMO, isShowcase } from "@/lib/demo";

const SHOWCASE = "This is one of the demo accounts on the sign-in page, so it can't be changed in the demo.";

const go = (path: string, k: "ok" | "err", m: string): never => redirect(`${path}${path.includes("?") ? "&" : "?"}${k}=${encodeURIComponent(m)}`);
const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

/* ---------------- institute ---------------- */
export async function saveOrg(fd: FormData) {
  const u = await requirePerm("masters");
  const { org } = await getSettings();
  const next = { ...org, name: s(fd, "name") || org.name, short: s(fd, "short").slice(0, 12), addr: s(fd, "addr"), prefix: s(fd, "prefix").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) || org.prefix, fy: s(fd, "fy") === "January – December" ? "January – December" : "April – March", weekoff: WEEKOFF_OPTIONS.includes(s(fd, "weekoff")) ? s(fd, "weekoff") : org.weekoff, tz: s(fd, "tz") || org.tz };
  const logo = s(fd, "logo"), png = s(fd, "logoPng");
  if (logo) {
    if (!/^data:image\/(png|jpeg|webp|svg\+xml);base64,/.test(logo) || logo.length > 700_000) go("/admin/institute", "err", "Use a PNG, JPG, WebP or SVG logo under 500 KB.");
    next.logo = logo; next.logoPng = /^data:image\/png;base64,/.test(png) && png.length < 700_000 ? png : null;
  }
  if (fd.get("removeLogo") === "1") { next.logo = null; next.logoPng = null; }
  await saveSetting("org", next);
  const changed = (Object.keys(next) as (keyof typeof next)[]).filter((k) => k !== "logoPng" && next[k] !== org[k]);
  await log(who(u), `Institute profile: changed ${changed.join(", ") || "nothing"}`);
  revalidatePath("/", "layout");
  go("/admin/institute", "ok", "Saved.");
}

/* ---------------- rules & workflows ---------------- */
export async function saveRules(fd: FormData) {
  const u = await requirePerm("masters");
  const thr = Math.min(100, Math.max(0, Number(s(fd, "thr")) || 0)), half = Math.min(12, Math.max(0, Number(s(fd, "half")) || 0));
  const start = s(fd, "start");
  if (start && !isDate(start)) go("/admin/rules", "err", "Tracking start date is not valid.");
  await saveSetting("rules", { thr, thrCat: s(fd, "thrCat"), merge: s(fd, "merge"), half, countOffs: s(fd, "countOffs") === "yes", start });
  await log(who(u), `Attendance rules saved (threshold ${thr}% for ${s(fd, "thrCat")}, half day under ${half} h)`);
  go("/admin/rules", "ok", "Saved.");
}
export async function saveFlows(fd: FormData) {
  const u = await requirePerm("masters");
  const { flows } = await getSettings();
  const next = flows.map((f) => ({ ...f, chain: [0, 1, 2].map((i) => s(fd, `${f.key}_${i}`)).filter((x) => (APPROVERS as readonly string[]).includes(x)) }));
  if (next.some((f) => !f.chain.length)) go("/admin/workflows", "err", "Every request needs at least one approver.");
  await saveSetting("flows", next);
  await log(who(u), `Approval workflows: ${next.map((f) => `${f.title} = ${f.chain.join(" → ")}`).join("; ")}`);
  go("/admin/workflows", "ok", "Saved. New requests follow these routes; requests already in progress keep theirs.");
}
export async function saveAccess(fd: FormData) {
  const u = await requireAdmin();
  const access = Object.fromEntries(ROLE_KEYS.map((r) => [r, r === "admin" ? [...PERM_KEYS] : PERM_KEYS.filter((p) => fd.get(`${r}:${p}`) === "on")])) as Access;
  await saveSetting("access", access);
  await log(who(u), `Roles & access: ${ROLE_KEYS.filter((r) => r !== "admin").map((r) => `${ROLES[r]} = ${access[r].join(", ") || "none"}`).join("; ")}`);
  go("/admin/access", "ok", "Saved.");
}
export async function savePolicy(fd: FormData) {
  const u = await requireAdmin();
  if (DEMO) go("/admin/users", "err", "The password policy is fixed in the demo so the demo accounts keep working.");
  const pol = { min: Math.min(32, Math.max(6, Number(s(fd, "min")) || 8)), complex: s(fd, "complex") === "yes", expiry: [0, 60, 90, 180].includes(Number(s(fd, "expiry"))) ? Number(s(fd, "expiry")) : 0, lock: [3, 5, 10].includes(Number(s(fd, "lock"))) ? Number(s(fd, "lock")) : 5, session: [4, 8, 12, 24].includes(Number(s(fd, "session"))) ? Number(s(fd, "session")) : 12 };
  await saveSetting("pol", pol);
  await log(who(u), `Password policy: min ${pol.min}, complexity ${pol.complex ? "on" : "off"}, expiry ${pol.expiry || "never"}, lock after ${pol.lock}, session ${pol.session} h`);
  go("/admin/users", "ok", "Password policy saved.");
}

/* ---------------- master fields ---------------- */
async function readRow(kind: string, fd: FormData, prefix: string) {
  const def = masterDef(kind)!;
  const cats = (await getMasters()).cat.filter((r) => r.active).map((r) => String(r.data[0]));
  const data: (string | number)[] = [];
  for (const c of def.cols) {
    let v: string | number = s(fd, prefix + c.key);
    if (c.required && !v) return { err: `${c.label} is required.` };
    if (c.type === "num") { if (v !== "" && isNaN(Number(v))) return { err: `${c.label} must be a number.` }; v = v === "" ? 0 : Number(v); }
    if (c.type === "date" && v && !isDate(v)) return { err: `${c.label} is not a valid date.` };
    if (c.type === "time" && v && !isTime(v)) return { err: `${c.label} should be HH:MM.` };
    if (c.type?.startsWith("sel:")) { const opts = c.type.slice(4).split("|").flatMap((x) => (x === "@cat" ? cats : [x])); if (v && !opts.includes(String(v))) return { err: `${c.label}: pick one of the options.` }; }
    if (c.key === "head" || c.key === "code") v = String(v).toUpperCase();
    data.push(v);
  }
  return { data };
}
export async function addMaster(fd: FormData) {
  const u = await requirePerm("masters");
  const kind = s(fd, "kind"), back = `/admin/masters/${kind}`;
  if (!masterDef(kind)) go("/", "err", "Unknown master.");
  const r = await readRow(kind, fd, "n_");
  if (r.err) go(back, "err", r.err);
  const dup = (await getMasters())[kind].find((x) => String(x.data[0]).toLowerCase() === String(r.data![0]).toLowerCase());
  if (dup) go(back, "err", `“${r.data![0]}” already exists.`);
  const mx = await db().select({ m: sql<number>`coalesce(max(${schema.masters.sort}),0)` }).from(schema.masters).where(eq(schema.masters.kind, kind));
  await db().insert(schema.masters).values({ kind, data: r.data!, sort: Number(mx[0].m) + 1 });
  await log(who(u), `${masterDef(kind)!.title}: added “${r.data![0]}”`);
  go(back, "ok", `Added “${r.data![0]}”.`);
}
export async function updateMaster(fd: FormData) {
  const u = await requirePerm("masters");
  const id = Number(fd.get("id")), row = (await db().select().from(schema.masters).where(eq(schema.masters.id, id)))[0];
  if (!row) go("/", "err", "That entry no longer exists.");
  const back = `/admin/masters/${row!.kind}`;
  const r = await readRow(row!.kind, fd, `r${id}_`);
  if (r.err) go(back, "err", r.err);
  const def = masterDef(row!.kind)!;
  const diffs = def.cols.map((c, i) => (String(row!.data[i] ?? "") !== String(r.data![i]) ? `${c.label.toLowerCase()} “${row!.data[i] ?? ""}” → “${r.data![i]}”` : "")).filter(Boolean);
  if (!diffs.length) go(back, "ok", "No changes.");
  await db().update(schema.masters).set({ data: r.data! }).where(eq(schema.masters.id, id));
  await log(who(u), `${def.title}: “${row!.data[0]}” ${diffs.join(", ")}`);
  go(back, "ok", "Saved.");
}
export async function toggleMaster(fd: FormData) {
  const u = await requirePerm("masters");
  const id = Number(fd.get("id")), row = (await db().select().from(schema.masters).where(eq(schema.masters.id, id)))[0];
  if (!row) go("/", "err", "That entry no longer exists.");
  await db().update(schema.masters).set({ active: !row!.active }).where(eq(schema.masters.id, id));
  await log(who(u), `${masterDef(row!.kind)!.title}: ${row!.active ? "deactivated" : "activated"} “${row!.data[0]}”`);
  go(`/admin/masters/${row!.kind}`, "ok", `“${row!.data[0]}” ${row!.active ? "deactivated" : "activated"}.`);
}
export async function deleteMaster(fd: FormData) {
  const u = await requirePerm("masters");
  const id = Number(fd.get("id")), row = (await db().select().from(schema.masters).where(eq(schema.masters.id, id)))[0];
  if (!row) go("/", "err", "That entry no longer exists.");
  await db().delete(schema.masters).where(eq(schema.masters.id, id));
  await log(who(u), `${masterDef(row!.kind)!.title}: removed “${row!.data[0]}”`);
  go(`/admin/masters/${row!.kind}`, "ok", `Removed “${row!.data[0]}”. Records that already use it keep the value.`);
}

/* ---------------- users ---------------- */
export type TempState = { login?: string; pw?: string; err?: string } | null;
export async function resetPassword(_: TempState, fd: FormData): Promise<TempState> {
  const u = await requireAdmin();
  const id = Number(fd.get("id"));
  const t = (await db().select().from(schema.users).where(eq(schema.users.id, id)))[0];
  if (!t) return { err: "Login not found." };
  if (isShowcase(t.login)) return { err: SHOWCASE };
  if (t.id === u.id) return { err: "Change your own password from Profile & password." };
  const pw = tempPassword();
  await db().update(schema.users).set({ passwordHash: await hashPassword(pw), mustChange: true, failed: 0, status: t.status === "Locked" ? "Active" : t.status }).where(eq(schema.users.id, id));
  await db().delete(schema.sessions).where(eq(schema.sessions.userId, id));
  await log(who(u), `Reset password for ${t.name} (${t.login})`);
  return { login: t.login, pw };
}
export async function createLogin(_: TempState, fd: FormData): Promise<TempState> {
  const u = await requireAdmin();
  const empId = s(fd, "employeeId").toUpperCase(), role = s(fd, "role") as Role;
  const { org } = await getSettings();
  const id = empId.startsWith(org.prefix + "-") ? empId.slice(org.prefix.length + 1) : empId;
  const e = (await db().select().from(schema.employees).where(eq(schema.employees.id, id)))[0];
  if (!e) return { err: `Employee ${id} not found. Add the employee record first.` };
  if (!ROLE_KEYS.includes(role)) return { err: "Pick a role." };
  const ex = await db().select().from(schema.users).where(eq(schema.users.login, id));
  if (ex.length) return { err: "This employee already has a login. Use Reset password instead." };
  const pw = tempPassword();
  await db().insert(schema.users).values({ login: id, employeeId: e.id, name: e.name, role, passwordHash: await hashPassword(pw), mustChange: true });
  await log(who(u), `Created ${ROLES[role]} login for ${e.name} (${id})`);
  revalidatePath("/admin/users");
  return { login: id, pw };
}
export async function userAction(fd: FormData) {
  const u = await requireAdmin();
  const id = Number(fd.get("id")), act = s(fd, "act");
  const t = (await db().select().from(schema.users).where(eq(schema.users.id, id)))[0];
  const back = `/admin/users?q=${encodeURIComponent(s(fd, "q"))}`;
  if (!t) go(back, "err", "Login not found.");
  if (t!.id === u.id) go(back, "err", "You cannot change your own login here.");
  if (isShowcase(t!.login)) go(back, "err", SHOWCASE);
  if (act === "unlock") await db().update(schema.users).set({ status: "Active", failed: 0 }).where(eq(schema.users.id, id));
  else if (act === "disable") { await db().update(schema.users).set({ status: "Disabled" }).where(eq(schema.users.id, id)); await db().delete(schema.sessions).where(eq(schema.sessions.userId, id)); }
  else if (act === "enable") await db().update(schema.users).set({ status: "Active", failed: 0 }).where(eq(schema.users.id, id));
  else if (act === "role") {
    const role = s(fd, "role") as Role;
    if (!ROLE_KEYS.includes(role)) go(back, "err", "Pick a role.");
    if (role === "admin" && !t!.employeeId) go(back, "err", "Pick a role.");
    await db().update(schema.users).set({ role }).where(eq(schema.users.id, id));
  }
  await log(who(u), `${act === "role" ? `Changed role of ${t!.name} to ${ROLES[s(fd, "role") as Role]}` : `${act[0].toUpperCase() + act.slice(1)}d login ${t!.name} (${t!.login})`}`);
  go(back, "ok", "Saved.");
}

/* ---------------- licence ---------------- */
export async function saveLicence(fd: FormData) {
  const u = await requireAdmin();
  if (DEMO) go("/admin/licence", "err", "The licence can't be changed in the demo.");
  const { readKey } = await import("@/lib/license");
  const key = s(fd, "key").replace(/\s+/g, "");
  const { lic, err } = readKey(key);
  if (!lic) go("/admin/licence", "err", err!);
  await db().insert(schema.settings).values({ key: "licence", value: key }).onConflictDoUpdate({ target: schema.settings.key, set: { value: key, updatedAt: new Date() } });
  await log(who(u), `Entered licence ${lic!.id} for ${lic!.c} (${lic!.e || "unlimited"} employees, expires ${lic!.x})`);
  revalidatePath("/", "layout");
  go("/admin/licence", "ok", "Licence key accepted.");
}
export async function removeLicence() {
  const u = await requireAdmin();
  if (DEMO) go("/admin/licence", "err", "The licence can't be changed in the demo.");
  await db().delete(schema.settings).where(eq(schema.settings.key, "licence"));
  await log(who(u), "Removed the stored licence key");
  go("/admin/licence", "ok", "Licence key removed.");
}
