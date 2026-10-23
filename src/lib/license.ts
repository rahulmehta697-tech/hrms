import "server-only";
import { cache } from "react";
import { createPublicKey, verify } from "crypto";
import { ne, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { LICENCE_PUBLIC_KEY } from "./license-public";
import { nowIn } from "./dates";

export type Licence = { id: string; c: string; e: number; x: string; i: string; g?: number };
export type LicenceState = "none" | "invalid" | "valid" | "expiring" | "grace" | "expired";
export const DEMO_LIMIT = 25;

/** Checks a licence key's signature and returns its contents, or an error message. */
export function readKey(key: string): { lic?: Licence; err?: string } {
  const k = key.trim().replace(/\s+/g, "");
  const m = /^HRMS1\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(k);
  if (!m) return { err: "That doesn't look like a licence key. It should start with HRMS1." };
  if (!LICENCE_PUBLIC_KEY.trim()) return { err: "This installation has no licence public key yet, so no key can be checked." };
  try {
    const ok = verify(null, Buffer.from(m[1]), createPublicKey(LICENCE_PUBLIC_KEY), Buffer.from(m[2], "base64url"));
    if (!ok) return { err: "The licence key is not genuine or has been altered." };
    const lic = JSON.parse(Buffer.from(m[1], "base64url").toString("utf8")) as Licence;
    if (!lic.c || !/^\d{4}-\d{2}-\d{2}$/.test(lic.x)) return { err: "The licence key is incomplete." };
    return { lic };
  } catch { return { err: "The licence key could not be read." }; }
}

async function storedKey() {
  const r = await db().select().from(schema.settings).where(sql`${schema.settings.key} = 'licence'`);
  return (r[0]?.value as string | undefined) || process.env.LICENSE_KEY || "";
}

export const licenceStatus = cache(async () => {
  const key = await storedKey();
  const employees = Number((await db().select({ c: sql<number>`count(*)` }).from(schema.employees).where(ne(schema.employees.status, "Exited")))[0].c);
  const base = { employees, key: !!key };
  if (!key) return { ...base, state: "none" as LicenceState, limit: DEMO_LIMIT, message: `No licence key. Demo mode: up to ${DEMO_LIMIT} employees.`, lic: undefined as Licence | undefined, daysLeft: 0 };
  const { lic, err } = readKey(key);
  if (!lic) return { ...base, state: "invalid" as LicenceState, limit: DEMO_LIMIT, message: `${err} Running in demo mode (up to ${DEMO_LIMIT} employees).`, lic: undefined, daysLeft: 0 };
  const today = nowIn().date;
  const daysLeft = Math.round((Date.parse(lic.x) - Date.parse(today)) / 864e5);
  const grace = lic.g ?? 15;
  const limit = lic.e || Infinity;
  const state: LicenceState = daysLeft >= 31 ? "valid" : daysLeft >= 0 ? "expiring" : -daysLeft <= grace ? "grace" : "expired";
  const lim = lic.e ? `up to ${lic.e.toLocaleString("en-IN")} employees` : "unlimited employees";
  const message = {
    valid: `Licensed to ${lic.c} until ${lic.x}, ${lim}.`,
    expiring: `Licence for ${lic.c} expires on ${lic.x} (${daysLeft} day${daysLeft === 1 ? "" : "s"} left). Renew to avoid interruption.`,
    grace: `Licence expired on ${lic.x}. The portal keeps working for ${grace + daysLeft} more day${grace + daysLeft === 1 ? "" : "s"}; renew now.`,
    expired: `Licence expired on ${lic.x}. Only the Master Admin can sign in until a new key is entered.`,
    none: "", invalid: "",
  }[state];
  return { ...base, state, limit, message, lic, daysLeft };
});

/** Returns an error message if adding `extra` employees would go over the licence. */
export async function employeeRoom(extra: number) {
  const s = await licenceStatus();
  if (s.state === "expired") return "The licence has expired. Enter a new licence key before adding employees.";
  if (s.employees + extra > s.limit) return `This would take you to ${(s.employees + extra).toLocaleString("en-IN")} employees, over the ${s.state === "none" || s.state === "invalid" ? "demo" : "licence"} limit of ${s.limit.toLocaleString("en-IN")}. ${s.state === "none" || s.state === "invalid" ? "Enter a licence key" : "Ask your vendor for a larger licence"}, or mark people who have left as Exited.`;
  return "";
}
