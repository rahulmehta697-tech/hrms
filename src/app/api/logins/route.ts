import { db, schema } from "@/db";
import { ne } from "drizzle-orm";
import { getSettings } from "@/lib/settings";
import { toXlsx } from "@/lib/files";
import { apiUser, deny, fileResponse, sameOrigin, slug } from "@/lib/api";
import { hashPassword, tempPassword, who } from "@/lib/auth";
import { deptHeads } from "@/lib/logic";
import { log } from "@/lib/audit";
import { nowIn } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Creates logins for every employee who has none and returns their temporary passwords as an Excel file. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return deny("Request blocked.");
  const u = await apiUser();
  if (!u || u.role !== "admin") return deny("Only the Master Admin can create logins.");
  const { org } = await getSettings();
  const have = new Set((await db().select({ l: schema.users.login }).from(schema.users)).map((x) => x.l));
  const missing = (await db().select().from(schema.employees).where(ne(schema.employees.status, "Exited")).orderBy(schema.employees.id)).filter((e) => !have.has(e.id.toUpperCase()));
  if (!missing.length) return deny("Every employee already has a login.", 400);
  // Password hashing is deliberately slow, so logins are created in batches that fit within one request.
  const BATCH = 200, emps = missing.slice(0, BATCH), remaining = missing.length - emps.length;
  const heads = new Set(Object.values(await deptHeads()).filter(Boolean));
  const rows: (string | number)[][] = [];
  for (let i = 0; i < emps.length; i += 50) {
    const chunk = emps.slice(i, i + 50);
    const vals = await Promise.all(chunk.map(async (e) => { const pw = tempPassword(); rows.push([`${org.prefix}-${e.id}`, e.name, e.department, e.mobile || "", pw]); return { login: e.id.toUpperCase(), employeeId: e.id, name: e.name, role: heads.has(e.id.toUpperCase()) ? "hod" : "staff", passwordHash: await hashPassword(pw), mustChange: true }; }));
    await db().insert(schema.users).values(vals).onConflictDoNothing();
  }
  await log(who(u), `Created ${rows.length} logins and downloaded their temporary passwords`);
  const buf = await toXlsx(org, "New logins and temporary passwords (confidential)", u.name, ["Login ID", "Name", "Department", "Mobile", "Temporary password"], rows);
  const res = fileResponse(buf, `${slug(org.short)}-new-logins-${nowIn(org.tz).date}-${String(Date.now()).slice(-4)}.xlsx`);
  res.headers.set("X-Created", String(rows.length));
  res.headers.set("X-Remaining", String(remaining));
  return res;
}
