"use server";
import { redirect } from "next/navigation";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser, who } from "@/lib/auth";
import { balances, chainFor, countLeaveDays, getEmployee } from "@/lib/logic";
import { isDate, isTime } from "@/lib/dates";
import { log } from "@/lib/audit";

const go = (path: string, k: "ok" | "err", m: string): never => redirect(`${path}${path.includes("?") ? "&" : "?"}${k}=${encodeURIComponent(m)}`);
const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function applyLeave(fd: FormData) {
  const u = await requireUser();
  const emp = await getEmployee(u.employeeId);
  if (!emp) go("/leave", "err", "Your login is not linked to an employee record.");
  const type = s(fd, "type"), from = s(fd, "from"), to = s(fd, "to");
  if (!isDate(from) || !isDate(to) || to < from) go("/leave", "err", "Pick a “To” date on or after the “From” date.");
  const days = await countLeaveDays(from, to);
  if (!days) go("/leave", "err", "Those dates are all holidays or weekly offs, so no leave is needed.");
  const bal = await balances(emp!.id, emp!.category, from);
  const b = bal.rows.find((r) => r.code === type);
  if (!b) go("/leave", "err", "That leave type is not available to you.");
  const clash = await db().select().from(schema.leaveRequests).where(and(eq(schema.leaveRequests.employeeId, emp!.id), inArray(schema.leaveRequests.status, ["pending", "approved"]), lte(schema.leaveRequests.fromDate, to), gte(schema.leaveRequests.toDate, from)));
  if (clash.length) go("/leave", "err", "You already have leave on some of these dates.");
  const chain = await chainFor(days > 3 ? "leave_long" : "leave_short", emp!.id);
  const ins = await db().insert(schema.leaveRequests).values({ employeeId: emp!.id, type, fromDate: from, toDate: to, days, reason: s(fd, "reason").slice(0, 500), cover: s(fd, "cover").slice(0, 200), status: "pending", chain, level: 0, history: [] }).returning({ id: schema.leaveRequests.id });
  await log(who(u), `Applied for ${days} day(s) of ${type} from ${from} to ${to} (LV-${ins[0].id})`);
  go("/leave", "ok", `Sent for approval: ${chain.join(" → ")}.${b!.available - days < 0 ? ` This is ${days - b!.available} day(s) more than your balance; the extra days may be loss of pay.` : ""}`);
}

export async function cancelLeave(fd: FormData) {
  const u = await requireUser();
  const id = Number(fd.get("id"));
  const r = (await db().select().from(schema.leaveRequests).where(eq(schema.leaveRequests.id, id)))[0];
  if (!r || r.employeeId !== u.employeeId || r.status !== "pending") go("/leave", "err", "Only your own pending requests can be cancelled.");
  await db().update(schema.leaveRequests).set({ status: "cancelled", history: [...r!.history, { level: "Applicant", by: u.name, action: "cancelled", at: new Date().toISOString() }] }).where(eq(schema.leaveRequests.id, id));
  await log(who(u), `Cancelled leave request LV-${id}`);
  go("/leave", "ok", "Request cancelled.");
}

export async function applyRegularise(fd: FormData) {
  const u = await requireUser();
  const emp = await getEmployee(u.employeeId);
  const back = `/attendance?m=${s(fd, "date").slice(0, 7)}&d=${s(fd, "date")}`;
  if (!emp) go("/attendance", "err", "Your login is not linked to an employee record.");
  const date = s(fd, "date"), time = s(fd, "time"), dir = s(fd, "direction") === "Out" ? "Out" : "In", reason = s(fd, "reason");
  if (!isDate(date) || !isTime(time)) go(back, "err", "Enter a valid date and time (HH:MM).");
  if (!reason) go(back, "err", "Give a reason for the missed punch.");
  const chain = await chainFor("regularise", emp!.id);
  await db().insert(schema.regRequests).values({ employeeId: emp!.id, date, time, direction: dir, reason: reason.slice(0, 500), status: "pending", chain, level: 0, history: [] });
  await log(who(u), `Requested regularisation for ${date} ${dir} ${time}`);
  go(back, "ok", `Regularisation sent for approval: ${chain.join(" → ")}.`);
}
