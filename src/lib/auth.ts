import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes, randomInt } from "crypto";
import bcrypt from "bcryptjs";
import { and, eq, gt, lt } from "drizzle-orm";
import { db, schema } from "@/db";
import { getSettings } from "./settings";
import type { Perm, Policy, Role } from "./config";

export const COOKIE = "hrms_s";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export const hashPassword = (pw: string) => bcrypt.hash(pw, 10);
export const checkPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

export function pwError(pw: string, pol: Policy, current?: string) {
  if (pw.length < pol.min) return `Use at least ${pol.min} characters.`;
  if (pol.complex && !(/[A-Za-z]/.test(pw) && /\d/.test(pw) && /[^A-Za-z0-9]/.test(pw))) return "Include a letter, a number and a symbol.";
  if (current && pw === current) return "Choose a password different from the current one.";
  return "";
}
export function pwRuleText(pol: Policy) {
  return `At least ${pol.min} characters${pol.complex ? ", with a letter, a number and a symbol" : ""}.${pol.expiry ? ` Passwords expire every ${pol.expiry} days.` : ""}`;
}
/** A temporary password that satisfies any policy up to 12 characters. */
export function tempPassword() {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ", a = "abcdefghjkmnpqrstuvwxyz", d = "23456789", s = "@#$%&*";
  const pick = (x: string) => x[randomInt(x.length)];
  return pick(A) + pick(a) + pick(a) + pick(a) + pick(s) + pick(d) + pick(d) + pick(d) + pick(a) + pick(A) + pick(d) + pick(a);
}

/** Login IDs are stored without the institute prefix, upper-case. */
export function normLogin(input: string, prefix: string) {
  let v = String(input || "").trim().toUpperCase();
  const p = prefix.toUpperCase() + "-";
  if (p.length > 1 && v.startsWith(p)) v = v.slice(p.length);
  return v;
}

export async function startSession(userId: number, hours: number) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + hours * 3600_000);
  await db().insert(schema.sessions).values({ id: sha(token), userId, expiresAt });
  await db().delete(schema.sessions).where(lt(schema.sessions.expiresAt, new Date()));
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires: expiresAt });
}
export async function endSession() {
  const c = await cookies();
  const t = c.get(COOKIE)?.value;
  if (t) await db().delete(schema.sessions).where(eq(schema.sessions.id, sha(t)));
  c.delete(COOKIE);
}

export type SessionUser = typeof schema.users.$inferSelect;

export const getUser = cache(async (): Promise<SessionUser | null> => {
  const t = (await cookies()).get(COOKIE)?.value;
  if (!t) return null;
  const r = await db().select({ u: schema.users }).from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.id, sha(t)), gt(schema.sessions.expiresAt, new Date()))).limit(1);
  const u = r[0]?.u;
  if (!u || u.status !== "Active") return null;
  return u;
});

export async function can(u: SessionUser | null, perm: Perm) {
  if (!u) return false;
  if (u.role === "admin") return true;
  const { access } = await getSettings();
  return (access[u.role as Role] || []).includes(perm);
}

/** For pages and actions: signed-in user who has finished the password step. */
export async function requireUser() {
  const u = await getUser();
  if (!u) redirect("/login");
  if (u.mustChange || (await passwordExpired(u))) redirect("/set-password");
  return u;
}
export async function requirePerm(perm: Perm) {
  const u = await requireUser();
  if (!(await can(u, perm))) redirect("/?err=" + encodeURIComponent("You don't have access to that page."));
  return u;
}
export async function requireAdmin() {
  const u = await requireUser();
  if (u.role !== "admin") redirect("/?err=" + encodeURIComponent("Only the Master Admin can open that page."));
  return u;
}
export async function passwordExpired(u: SessionUser) {
  const { pol } = await getSettings();
  return !!pol.expiry && Date.now() - new Date(u.pwChangedAt).getTime() > pol.expiry * 86400_000;
}
export const who = (u: SessionUser) => `${u.name} (${u.login})`;
