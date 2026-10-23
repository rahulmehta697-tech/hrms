"use server";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { timingSafeEqual } from "crypto";
import { db, schema } from "@/db";
import { getSettings, isSetUp } from "@/lib/settings";
import { DEFAULTS, MASTERS } from "@/lib/config";
import { checkPassword, endSession, getUser, hashPassword, normLogin, pwError, startSession, who } from "@/lib/auth";
import { log } from "@/lib/audit";

const q = (path: string, k: "ok" | "err", m: string, extra = "") => `${path}?${k}=${encodeURIComponent(m)}${extra}`;
const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function login(fd: FormData) {
  const { org, pol } = await getSettings();
  const raw = s(fd, "login"), pw = String(fd.get("password") ?? "");
  const back = (m: string): never => redirect(q("/login", "err", m, "&u=" + encodeURIComponent(raw)));
  if (!raw || !pw) back("Enter your employee ID and password.");
  const id = normLogin(raw, org.prefix);
  const u = (await db().select().from(schema.users).where(eq(schema.users.login, id)).limit(1))[0];
  if (!u) back("No login exists for that employee ID. Check the ID on your ID card or ask the HR office.");
  if (u.status === "Disabled") back("This login is disabled. Contact the HR office.");
  if (u.status === "Locked") back(`This login is locked after ${pol.lock} wrong attempts. Ask the Master Admin to unlock it.`);
  if (!(await checkPassword(pw, u.passwordHash))) {
    const failed = u.failed + 1, locked = failed >= pol.lock;
    await db().update(schema.users).set({ failed, status: locked ? "Locked" : u.status }).where(eq(schema.users.id, u.id));
    if (locked) await log("System", `Locked login ${u.login} after ${failed} wrong passwords`);
    back(locked ? `Wrong password. The login is now locked after ${pol.lock} attempts. Ask the Master Admin to unlock it.` : `Wrong password. ${pol.lock - failed} attempt${pol.lock - failed > 1 ? "s" : ""} left before the login locks.`);
  }
  await db().update(schema.users).set({ failed: 0, lastLogin: new Date() }).where(eq(schema.users.id, u.id));
  await startSession(u.id, pol.session);
  await log(who(u), "Signed in");
  redirect(u.mustChange ? "/set-password" : "/");
}

export async function logout() {
  const u = await getUser();
  if (u) await log(who(u), "Signed out");
  await endSession();
  redirect("/login");
}

export async function setPassword(fd: FormData) {
  const u = await getUser();
  if (!u) redirect("/login");
  const { pol } = await getSettings();
  const n = String(fd.get("new") ?? ""), c = String(fd.get("confirm") ?? "");
  const same = await checkPassword(n, u.passwordHash);
  const err = pwError(n, pol) || (same ? "Choose a password different from the current one." : "") || (n !== c ? "The two passwords do not match." : "");
  if (err) redirect(q("/set-password", "err", err));
  await db().update(schema.users).set({ passwordHash: await hashPassword(n), mustChange: false, pwChangedAt: new Date() }).where(eq(schema.users.id, u.id));
  await log(who(u), "Set a new password");
  redirect(q("/", "ok", "Password saved. Welcome!"));
}

export async function changePassword(fd: FormData) {
  const u = await getUser();
  if (!u) redirect("/login");
  const { pol } = await getSettings();
  const o = String(fd.get("current") ?? ""), n = String(fd.get("new") ?? ""), c = String(fd.get("confirm") ?? "");
  if (!(await checkPassword(o, u.passwordHash))) redirect(q("/profile", "err", "Current password is incorrect."));
  const err = pwError(n, pol, o) || (n !== c ? "The two new passwords do not match." : "");
  if (err) redirect(q("/profile", "err", err));
  await db().update(schema.users).set({ passwordHash: await hashPassword(n), mustChange: false, pwChangedAt: new Date() }).where(eq(schema.users.id, u.id));
  await log(who(u), "Changed own password");
  redirect(q("/profile", "ok", "Password updated. Use it the next time you sign in."));
}

export async function runSetup(fd: FormData) {
  if (await isSetUp()) redirect("/login");
  const key = process.env.SETUP_KEY || "";
  const given = s(fd, "key");
  const match = key.length >= 8 && given.length === key.length && timingSafeEqual(Buffer.from(given), Buffer.from(key));
  if (!match) redirect(q("/setup", "err", key ? "The setup key does not match SETUP_KEY in your hosting settings." : "SETUP_KEY is not set (or is shorter than 8 characters) in your hosting settings. Add it, redeploy, then try again."));
  const pw = String(fd.get("password") ?? ""), c = String(fd.get("confirm") ?? "");
  const err = pwError(pw, DEFAULTS.pol) || (pw !== c ? "The two passwords do not match." : "");
  if (err) redirect(q("/setup", "err", err));
  const org = { ...DEFAULTS.org, name: s(fd, "name") || DEFAULTS.org.name, short: s(fd, "short") || DEFAULTS.org.short, addr: s(fd, "addr") || DEFAULTS.org.addr, prefix: (s(fd, "prefix") || "EMP").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) || "EMP" };
  const hash = await hashPassword(pw);
  let fresh = false;
  await db().transaction(async (tx) => {
    const admins = await tx.select({ n: sql<number>`count(*)` }).from(schema.users).where(eq(schema.users.role, "admin"));
    if (Number(admins[0].n) > 0) return;
    const hasSettings = await tx.select({ n: sql<number>`count(*)` }).from(schema.settings);
    fresh = Number(hasSettings[0].n) === 0;
    if (fresh) for (const [k, v] of Object.entries({ ...DEFAULTS, org, rules: { ...DEFAULTS.rules, start: new Date().toISOString().slice(0, 10) } })) await tx.insert(schema.settings).values({ key: k, value: v }).onConflictDoNothing();
    const existing = await tx.select({ n: sql<number>`count(*)` }).from(schema.masters);
    if (Number(existing[0].n) === 0) for (const m of MASTERS) if (m.seed.length) await tx.insert(schema.masters).values(m.seed.map((d, i) => ({ kind: m.kind, data: d, sort: i })));
    await tx.delete(schema.users).where(eq(schema.users.login, "ADMIN"));
    await tx.insert(schema.users).values({ login: "ADMIN", name: "Master Admin", role: "admin", passwordHash: hash, mustChange: false, status: "Active" });
  });
  const u = (await db().select().from(schema.users).where(eq(schema.users.login, "ADMIN")).limit(1))[0];
  await log("Master Admin (ADMIN)", fresh ? "Completed first-run setup" : "Recreated the Master Admin login from the setup page");
  await startSession(u.id, DEFAULTS.pol.session);
  redirect(q("/admin/institute", "ok", "Setup complete. You are signed in as Master Admin (login ID: admin)."));
}
