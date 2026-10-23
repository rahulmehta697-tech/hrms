import "server-only";
import { and, eq, gte, lte, inArray, ne, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { getSettings, getMasters, activeRows } from "./settings";
import { APPROVER_ROLE } from "./config";
import { addDays, daysInMonth, isWeeklyOff, toMin, nowIn } from "./dates";
import type { SessionUser } from "./auth";
import type { Step, PayLine } from "@/db/schema";

/* ---------------- people ---------------- */
export async function getEmployee(id: string | null | undefined) {
  if (!id) return null;
  const r = await db().select().from(schema.employees).where(eq(schema.employees.id, id)).limit(1);
  return r[0] || null;
}
/** Department name -> head employee ID, from the Departments master. */
export async function deptHeads() {
  const m = await getMasters();
  return Object.fromEntries((m.dept || []).filter((r) => r.active).map((r) => [String(r.data[0]), String(r.data[2] || "").trim().toUpperCase()]));
}
export async function departmentsHeadedBy(empId: string | null) {
  if (!empId) return [];
  const heads = await deptHeads();
  return Object.entries(heads).filter(([, h]) => h === empId.toUpperCase()).map(([d]) => d);
}

/* ---------------- calendar ---------------- */
export async function holidaySet() {
  return new Set((await activeRows("hol")).map((r) => String(r.data[0])));
}
export async function holidayName(date: string) {
  return (await activeRows("hol")).find((r) => r.data[0] === date)?.data[1] as string | undefined;
}

/* ---------------- leave ---------------- */
export function leaveYear(date: string, fy: string) {
  const y = Number(date.slice(0, 4)), m = Number(date.slice(5, 7));
  if (fy.startsWith("April")) { const s = m >= 4 ? y : y - 1; return { year: s, from: `${s}-04-01`, to: `${s + 1}-03-31`, label: `${s}-${String(s + 1).slice(2)}` }; }
  return { year: y, from: `${y}-01-01`, to: `${y}-12-31`, label: String(y) };
}
/** Loads holidays and settings once and returns a fast day counter (for bulk imports). */
export async function leaveCounter() {
  const { rules, org } = await getSettings();
  const hol = await holidaySet();
  return (from: string, to: string) => {
    if (rules.countOffs) return Math.round((Date.parse(to) - Date.parse(from)) / 864e5) + 1;
    let n = 0;
    for (let d = from; d <= to; d = addDays(d, 1)) if (!hol.has(d) && !isWeeklyOff(d, org.weekoff)) n++;
    return n;
  };
}
export async function countLeaveDays(from: string, to: string) {
  const { rules, org } = await getSettings();
  if (rules.countOffs) return Math.round((Date.parse(to) - Date.parse(from)) / 864e5) + 1;
  const hol = await holidaySet();
  let n = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) if (!hol.has(d) && !isWeeklyOff(d, org.weekoff)) n++;
  return n;
}
/** Leave types that apply to an employee, with quota, opening, used and pending for the current leave year. */
export async function balances(empId: string, category: string, onDate?: string) {
  const { org } = await getSettings();
  const ly = leaveYear(onDate || nowIn(org.tz).date, org.fy);
  const types = (await activeRows("leave")).filter((r) => r.data[4] === "All staff" || r.data[4] === category);
  const reqs = await db().select().from(schema.leaveRequests).where(and(eq(schema.leaveRequests.employeeId, empId), inArray(schema.leaveRequests.status, ["approved", "pending"]), gte(schema.leaveRequests.toDate, ly.from), lte(schema.leaveRequests.fromDate, ly.to)));
  const open = await db().select().from(schema.leaveOpening).where(and(eq(schema.leaveOpening.employeeId, empId), eq(schema.leaveOpening.year, ly.year)));
  return {
    year: ly,
    rows: types.map((t) => {
      const code = String(t.data[0]);
      const used = reqs.filter((r) => r.type === code && r.status === "approved").reduce((s, r) => s + Number(r.days), 0);
      const pending = reqs.filter((r) => r.type === code && r.status === "pending").reduce((s, r) => s + Number(r.days), 0);
      const opening = Number(open.find((o) => o.type === code)?.opening || 0);
      const quota = Number(t.data[2] || 0);
      return { code, name: String(t.data[1]), quota, opening, used, pending, available: quota + opening - used - pending };
    }),
  };
}

/* ---------------- approvals ---------------- */
export async function chainFor(flowKey: string, empId: string) {
  const { flows } = await getSettings();
  const emp = await getEmployee(empId);
  const heads = await deptHeads();
  const head = emp ? heads[emp.department] : "";
  let chain = (flows.find((f) => f.key === flowKey)?.chain || ["HR Office"]).filter((x) => x && x !== "—");
  if (!head || head === empId.toUpperCase()) chain = chain.filter((x) => x !== "Reporting HOD");
  return chain.length ? chain : ["HR Office"];
}
export async function canActOn(u: SessionUser, level: string, empId: string) {
  if (u.role === "admin") return true;
  if (u.employeeId && u.employeeId.toUpperCase() === empId.toUpperCase()) return false;
  const need = APPROVER_ROLE[level];
  if (need === "hodOf") {
    const emp = await getEmployee(empId);
    const heads = await deptHeads();
    return !!emp && !!u.employeeId && heads[emp.department] === u.employeeId.toUpperCase();
  }
  return u.role === need;
}
type Req = { id: number; employeeId: string; chain: string[]; level: number; status: string };
/** Pending requests the user can act on now. */
export async function actionable<T extends Req>(u: SessionUser, rows: T[]) {
  const pend = rows.filter((r) => r.status === "pending");
  if (!pend.length) return [];
  if (u.role === "admin") return pend;
  const me = (u.employeeId || "").toUpperCase();
  const needHod = pend.some((r) => r.chain[r.level] === "Reporting HOD");
  const heads = needHod ? await deptHeads() : {};
  const ids = [...new Set(pend.map((r) => r.employeeId))];
  const dept = needHod ? new Map((await db().select({ id: schema.employees.id, d: schema.employees.department }).from(schema.employees).where(inArray(schema.employees.id, ids))).map((e) => [e.id, e.d])) : new Map<string, string>();
  return pend.filter((r) => {
    if (me && r.employeeId.toUpperCase() === me) return false;
    const need = APPROVER_ROLE[r.chain[r.level]];
    if (need === "hodOf") return !!me && heads[dept.get(r.employeeId) || ""] === me;
    return u.role === need;
  });
}
export function nextState(r: Req & { history: Step[] }, by: string, action: "approve" | "reject", note?: string) {
  const at = new Date().toISOString();
  const history = [...r.history, { level: r.chain[r.level], by, action, at, note }];
  if (action === "reject") return { status: "rejected", level: r.level, history };
  const level = r.level + 1;
  return { status: level >= r.chain.length ? "approved" : "pending", level, history };
}

/* ---------------- attendance ---------------- */
export async function shiftInfo() {
  const sh = await activeRows("shift");
  const map = Object.fromEntries(sh.map((r) => [String(r.data[0]), { start: String(r.data[1] || "08:30"), end: String(r.data[2] || "16:30"), grace: Number(r.data[3] || 0) }]));
  const def = sh[0] ? map[String(sh[0].data[0])] : { start: "08:30", end: "16:30", grace: 15 };
  return { map, def };
}
export type DayStatus = "Present" | "Late" | "Half day" | "On leave" | "Holiday" | "Weekly off" | "Absent" | "Not punched" | "Upcoming" | "Not tracked";

type Emp = typeof schema.employees.$inferSelect;
/** Daily attendance for a set of employees across a date range. */
export async function attendanceGrid(emps: Emp[], from: string, to: string) {
  const { org, rules } = await getSettings();
  const today = nowIn(org.tz).date;
  const ids = emps.map((e) => e.id);
  const hol = await holidaySet();
  const { map, def } = await shiftInfo();
  const P = ids.length ? await db().select().from(schema.punches).where(and(inArray(schema.punches.employeeId, ids), gte(schema.punches.date, from), lte(schema.punches.date, to))) : [];
  const L = ids.length ? await db().select().from(schema.leaveRequests).where(and(inArray(schema.leaveRequests.employeeId, ids), eq(schema.leaveRequests.status, "approved"), lte(schema.leaveRequests.fromDate, to), gte(schema.leaveRequests.toDate, from))) : [];
  const byKey = new Map<string, typeof P>();
  for (const p of P) { const k = p.employeeId + "|" + p.date; if (!byKey.has(k)) byKey.set(k, []); byKey.get(k)!.push(p); }
  const out = new Map<string, { date: string; first: string; last: string; hours: string; sources: string; n: number; st: DayStatus; leave?: string; punches: typeof P }[]>();
  for (const e of emps) {
    const sh = (e.shift && map[e.shift]) || def;
    const days = [];
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const p = (byKey.get(e.id + "|" + d) || []).sort((a, b) => (a.time < b.time ? -1 : 1));
      const ins = p.filter((x) => x.direction === "In"), outs = p.filter((x) => x.direction === "Out");
      const first = ins[0]?.time || p[0]?.time || "", last = outs.length ? outs[outs.length - 1].time : "";
      const hrs = first && last && last > first ? (toMin(last) - toMin(first)) / 60 : 0;
      const lv = L.find((l) => l.employeeId === e.id && l.fromDate <= d && l.toDate >= d);
      let st: DayStatus;
      if (p.length) st = hrs && hrs < rules.half ? "Half day" : first && toMin(first) > toMin(sh.start) + sh.grace ? "Late" : "Present";
      else if (lv) st = "On leave";
      else if (hol.has(d)) st = "Holiday";
      else if (isWeeklyOff(d, org.weekoff)) st = "Weekly off";
      else if (d > today) st = "Upcoming";
      else if ((rules.start && d < rules.start) || (e.doj && d < e.doj)) st = "Not tracked";
      else if (d === today) st = "Not punched";
      else st = "Absent";
      days.push({ date: d, first, last, hours: hrs ? hrs.toFixed(1) : "", sources: [...new Set(p.map((x) => x.source))].join(", "), n: p.length, st, leave: lv?.type, punches: p });
    }
    out.set(e.id, days);
  }
  return out;
}
export function summarise(days: { st: DayStatus }[]) {
  const c = (s: DayStatus) => days.filter((d) => d.st === s).length;
  const present = c("Present") + c("Late") + c("Half day") * 0.5;
  const working = days.filter((d) => !["Holiday", "Weekly off", "Upcoming", "Not punched", "Not tracked"].includes(d.st)).length;
  return { present, late: c("Late"), half: c("Half day"), leave: c("On leave"), absent: c("Absent"), working, pct: working ? Math.round((present / working) * 1000) / 10 : 0 };
}

/* ---------------- payroll ---------------- */
export async function computePayroll(month: string) {
  const sal = await activeRows("sal");
  const kind = Object.fromEntries(sal.map((r) => [String(r.data[0]), String(r.data[1])]));
  const emps = await db().select().from(schema.employees).where(ne(schema.employees.status, "Exited"));
  const struct = await db().select().from(schema.salaryStructure);
  const inputs = await db().select().from(schema.payInputs).where(eq(schema.payInputs.month, month));
  const days = daysInMonth(month);
  const lines: { month: string; employeeId: string; data: PayLine }[] = [];
  for (const e of emps) {
    const st = struct.filter((s) => s.employeeId === e.id);
    if (!st.length) continue;
    const inp = inputs.filter((i) => i.employeeId === e.id);
    const lop = Math.min(days, inp.filter((i) => i.component === "LOP days").reduce((s, i) => s + Number(i.amount), 0));
    const paid = days - lop, f = paid / days;
    const earnings: [string, number][] = [], deductions: [string, number][] = [], employer: [string, number][] = [];
    const add = (arr: [string, number][], name: string, amt: number) => { if (!amt) return; const x = arr.find((a) => a[0] === name); if (x) x[1] += amt; else arr.push([name, amt]); };
    for (const s of st) if (kind[s.component] === "Earning") add(earnings, s.component, Math.round(Number(s.amount) * f));
    for (const i of inp) if (kind[i.component] === "Earning") add(earnings, i.component, Math.round(Number(i.amount)));
    const gross = earnings.reduce((s, x) => s + x[1], 0);
    const basic = earnings.find((x) => x[0] === "Basic pay")?.[1] || 0;
    const has = (n: string) => st.some((s) => s.component === n);
    if (has("Provident fund")) add(deductions, "Provident fund", Math.round(Math.min(basic, 15000) * 0.12));
    const esi = has("ESI") && gross > 0 && gross <= 21000;
    if (esi) add(deductions, "ESI", Math.ceil(gross * 0.0075));
    for (const s of st) if (kind[s.component] === "Deduction" && !["Provident fund", "ESI"].includes(s.component)) add(deductions, s.component, Math.round(Number(s.amount)));
    for (const i of inp) if (kind[i.component] === "Deduction") add(deductions, i.component, Math.round(Number(i.amount)));
    if (has("Employer PF")) add(employer, "Employer PF", Math.round(Math.min(basic, 15000) * 0.12));
    if (esi) add(employer, "Employer ESI", Math.ceil(gross * 0.0325));
    const ded = deductions.reduce((s, x) => s + x[1], 0);
    lines.push({ month, employeeId: e.id, data: { earnings, deductions, employer, gross, ded, net: gross - ded, paidDays: paid, days, lop } });
  }
  await db().transaction(async (tx) => {
    await tx.delete(schema.payrollLines).where(eq(schema.payrollLines.month, month));
    for (let i = 0; i < lines.length; i += 500) await tx.insert(schema.payrollLines).values(lines.slice(i, i + 500));
  });
  return lines.length;
}
export { sql };
