import "server-only";
import { and, asc, desc, eq, gte, inArray, lte, ne, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { getMasters, getSettings } from "./settings";
import { MASTERS, STAGES, EMP_STATUS, ROLES, type Perm, type Role } from "./config";
import { attendanceGrid, leaveCounter, summarise } from "./logic";
import { daysInMonth, fd, fdt, isDate, isTime, monthLabel, nowIn, MONTHS, pad } from "./dates";
import type { SessionUser } from "./auth";
import { employeeRoom } from "./license";

type Cell = string | number;
export type Ctx = { u: SessionUser; p: URLSearchParams; prefix: string; tz: string };
type Imp = {
  headers: string[];
  help: string[];
  types?: Record<string, "date" | "time" | "num">;
  required?: string[];
  prepare?: (ctx: Ctx) => Promise<unknown>;
  validate: (o: Record<string, Cell>, prep: any, ctx: Ctx) => string; // eslint-disable-line @typescript-eslint/no-explicit-any
  commit: (list: Record<string, Cell>[], prep: any, ctx: Ctx) => Promise<string>; // eslint-disable-line @typescript-eslint/no-explicit-any
};
export type DataSet = { title: (ctx: Ctx) => string; file: string; perm: Perm[] | "admin"; headers: (ctx: Ctx) => Promise<string[]> | string[]; rows: (ctx: Ctx) => Promise<Cell[][]>; imp?: Imp };

const DATEH = "Date as DD-MM-YYYY or YYYY-MM-DD";
const S = (v: Cell | undefined) => String(v ?? "").trim();
const pid = (ctx: Ctx, id: string) => `${ctx.prefix}-${id}`;
export function normId(v: Cell | undefined, prefix: string) {
  let s = S(v).toUpperCase();
  const p = prefix.toUpperCase() + "-";
  if (s.startsWith(p)) s = s.slice(p.length);
  return s;
}
const ci = (list: string[], v: Cell | undefined) => list.find((x) => x.toLowerCase() === S(v).toLowerCase());
async function empSet() {
  const r = await db().select({ id: schema.employees.id, name: schema.employees.name, department: schema.employees.department, category: schema.employees.category, status: schema.employees.status }).from(schema.employees);
  return new Map(r.map((e) => [e.id.toUpperCase(), e]));
}
async function act(kind: string, col = 0) {
  const m = await getMasters();
  return (m[kind] || []).filter((r) => r.active).map((r) => String(r.data[col]));
}
function monthParam(ctx: Ctx) { const m = ctx.p.get("m"); return m && /^\d{4}-\d{2}$/.test(m) ? m : nowIn(ctx.tz).date.slice(0, 7); }
function normMonth(v: Cell) {
  const s = S(v);
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  const m = s.match(/^([A-Za-z]{3})[a-z]*[\s\-/]+(\d{4})$/);
  if (m) { const i = MONTHS.findIndex((x) => x.toLowerCase() === m[1].toLowerCase()); if (i >= 0) return `${m[2]}-${pad(i + 1)}`; }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.slice(0, 7);
  return "";
}

export const DATASETS: Record<string, DataSet> = {
  employees: {
    title: () => "Employee master", file: "employees", perm: ["employees"],
    headers: () => ["Employee ID", "Full name", "Designation", "Department", "Category", "Date of joining", "Status", "Shift", "Mobile", "Email", "PAN", "UAN", "Bank account", "IFSC"],
    rows: async (ctx) => (await db().select().from(schema.employees).orderBy(asc(schema.employees.id))).map((e) => [pid(ctx, e.id), e.name, e.designation, e.department, e.category, e.doj || "", e.status, e.shift || "", e.mobile || "", e.email || "", e.pan || "", e.uan || "", e.bankAccount || "", e.ifsc || ""]),
    imp: {
      headers: ["Employee ID", "Full name", "Designation", "Department", "Category", "Date of joining", "Status", "Shift", "Mobile", "Email", "PAN", "UAN", "Bank account", "IFSC"],
      help: ["Category ID code + dash + number, e.g. F-1042. The institute prefix is optional. An existing ID updates that employee.", "Full name as it should appear on payslips", "One of the active designations", "One of the active departments", "One of the active categories", DATEH, "Active, Probation, On notice or Exited (blank = Active)", "One of the active shifts (blank = default shift)", "10-digit mobile", "Email", "PAN (optional)", "PF UAN (optional)", "Bank account number for salary (optional)", "IFSC (optional)"],
      types: { "Date of joining": "date" }, required: ["Employee ID", "Full name", "Designation", "Department", "Category"],
      prepare: async () => ({ desig: await act("desig"), dept: await act("dept"), cat: await act("cat"), codes: await act("cat", 1), shift: await act("shift") }),
      validate: (o, p, ctx) => {
        const id = normId(o["Employee ID"], ctx.prefix);
        if (!/^[A-Z0-9]{1,4}-[A-Z0-9]{1,8}$/.test(id)) return "Employee ID should look like F-1042";
        if (!S(o["Full name"])) return "Full name is required";
        if (!ci(p.desig, o["Designation"])) return `Designation “${S(o["Designation"])}” is not an active designation`;
        if (!ci(p.dept, o["Department"])) return `Department “${S(o["Department"])}” is not an active department`;
        if (!ci(p.cat, o["Category"])) return `Category “${S(o["Category"])}” is not an active category`;
        if (S(o["Date of joining"]) && !isDate(o["Date of joining"])) return "Date of joining is not a valid date";
        if (S(o["Status"]) && !ci(EMP_STATUS, o["Status"])) return "Status should be Active, Probation, On notice or Exited";
        if (S(o["Shift"]) && !ci(p.shift, o["Shift"])) return `Shift “${S(o["Shift"])}” is not an active shift`;
        if (S(o["Mobile"]) && S(o["Mobile"]).replace(/\D/g, "").length < 10) return "Mobile should have 10 digits";
        return "";
      },
      commit: async (list, p, ctx) => {
        const existing = await empSet();
        const vals = new Map<string, typeof schema.employees.$inferInsert>();
        for (const o of list) {
          const id = normId(o["Employee ID"], ctx.prefix);
          vals.set(id, { id, name: S(o["Full name"]), designation: ci(p.desig, o["Designation"])!, department: ci(p.dept, o["Department"])!, category: ci(p.cat, o["Category"])!, doj: S(o["Date of joining"]) || null, status: ci(EMP_STATUS, o["Status"]) || "Active", shift: ci(p.shift, o["Shift"]) || null, mobile: S(o["Mobile"]) || null, email: S(o["Email"]) || null, pan: S(o["PAN"]) || null, uan: S(o["UAN"]) || null, bankAccount: S(o["Bank account"]) || null, ifsc: S(o["IFSC"]).toUpperCase() || null });
        }
        const all = [...vals.values()];
        const newActive = all.filter((v) => !existing.has(v.id) && v.status !== "Exited").length;
        const room = newActive ? await employeeRoom(newActive) : "";
        if (room) throw new Error(room);
        const ex = (c: string) => sql.raw(`excluded.${c}`);
        for (let i = 0; i < all.length; i += 500) await db().insert(schema.employees).values(all.slice(i, i + 500)).onConflictDoUpdate({ target: schema.employees.id, set: { name: ex("name"), designation: ex("designation"), department: ex("department"), category: ex("category"), doj: ex("doj"), status: ex("status"), shift: ex("shift"), mobile: ex("mobile"), email: ex("email"), pan: ex("pan"), uan: ex("uan"), bankAccount: ex("bank_account"), ifsc: ex("ifsc") } });
        await db().execute(sql`update users set name = e.name from employees e where users.login = upper(e.id) and users.name <> e.name`);
        const added = all.filter((v) => !existing.has(v.id)).length, updated = all.length - added;
        return `${added} employee${added === 1 ? "" : "s"} added, ${updated} updated. Create logins for new employees from Users & passwords.`;
      },
    },
  },
  punches: {
    title: (ctx) => `Attendance punches ${fd(ctx.p.get("from") || "")} to ${fd(ctx.p.get("to") || "")}`, file: "attendance-punches", perm: ["attendance"],
    headers: () => ["Employee ID", "Name", "Date", "Time", "In / Out", "Source"],
    rows: async (ctx) => {
      const t = nowIn(ctx.tz).date, from = ctx.p.get("from") || t, to = ctx.p.get("to") || from;
      const r = await db().select({ p: schema.punches, n: schema.employees.name }).from(schema.punches).leftJoin(schema.employees, eq(schema.employees.id, schema.punches.employeeId)).where(and(gte(schema.punches.date, from), lte(schema.punches.date, to))).orderBy(asc(schema.punches.date), asc(schema.punches.employeeId), asc(schema.punches.time));
      return r.map((x) => [pid(ctx, x.p.employeeId), x.n || "", x.p.date, x.p.time, x.p.direction, x.p.source]);
    },
    imp: {
      headers: ["Employee ID", "Date", "Time", "In / Out", "Source"],
      help: ["Existing employee ID, with or without the prefix", DATEH, "Time as HH:MM, 24-hour", "In or Out", "Name of an active attendance source (see Master fields → Attendance sources)"],
      types: { Date: "date", Time: "time" }, required: ["Employee ID", "Date", "Time", "In / Out", "Source"],
      prepare: async () => ({ emps: await empSet(), src: await act("src") }),
      validate: (o, p, ctx) => {
        if (!p.emps.has(normId(o["Employee ID"], ctx.prefix))) return `Employee ID “${S(o["Employee ID"])}” not found`;
        if (!isDate(o.Date)) return "Date is not valid";
        if (!isTime(o.Time)) return "Time should be HH:MM (24-hour)";
        if (!/^(in|out)$/i.test(S(o["In / Out"]))) return "In / Out should be In or Out";
        if (!ci(p.src, o.Source)) return `Source “${S(o.Source)}” is not an active attendance source`;
        return "";
      },
      commit: async (list, p, ctx) => {
        const vals = list.map((o) => ({ employeeId: normId(o["Employee ID"], ctx.prefix), date: S(o.Date), time: S(o.Time), direction: /^in$/i.test(S(o["In / Out"])) ? "In" : "Out", source: ci(p.src, o.Source)! }));
        const dates = [...new Set(vals.map((v) => v.date))];
        const have = new Set((await db().select().from(schema.punches).where(inArray(schema.punches.date, dates))).map((x) => [x.employeeId, x.date, x.time, x.direction, x.source].join("|")));
        const fresh = vals.filter((v) => { const k = [v.employeeId, v.date, v.time, v.direction, v.source].join("|"); if (have.has(k)) return false; have.add(k); return true; });
        for (let i = 0; i < fresh.length; i += 1000) await db().insert(schema.punches).values(fresh.slice(i, i + 1000));
        return `${fresh.length} punches added${vals.length - fresh.length ? `, ${vals.length - fresh.length} duplicates skipped` : ""}.`;
      },
    },
  },
  "attendance-day": {
    title: (ctx) => `Attendance register, ${fd(ctx.p.get("d") || nowIn(ctx.tz).date)}`, file: "attendance-register", perm: ["attendance"],
    headers: () => ["Employee ID", "Name", "Department", "First in", "Last out", "Hours", "Punches", "Sources", "Status"],
    rows: async (ctx) => {
      const d = ctx.p.get("d") || nowIn(ctx.tz).date, dept = ctx.p.get("dept");
      const emps = await db().select().from(schema.employees).where(dept ? and(ne(schema.employees.status, "Exited"), eq(schema.employees.department, dept)) : ne(schema.employees.status, "Exited")).orderBy(asc(schema.employees.department), asc(schema.employees.name));
      const g = await attendanceGrid(emps, d, d);
      return emps.map((e) => { const x = g.get(e.id)![0]; return [pid(ctx, e.id), e.name, e.department, x.first, x.last, x.hours, x.n, x.sources, x.st]; });
    },
  },
  "attendance-month": {
    title: (ctx) => `Monthly attendance summary, ${monthLabel(monthParam(ctx))}`, file: "attendance-summary", perm: ["attendance"],
    headers: () => ["Employee ID", "Name", "Department", "Category", "Present days", "Late marks", "Half days", "Leave days", "Absent days", "Working days", "Attendance %"],
    rows: async (ctx) => {
      const m = monthParam(ctx), dept = ctx.p.get("dept");
      const today = nowIn(ctx.tz).date, last = `${m}-${pad(daysInMonth(m))}`;
      const emps = await db().select().from(schema.employees).where(dept ? and(ne(schema.employees.status, "Exited"), eq(schema.employees.department, dept)) : ne(schema.employees.status, "Exited")).orderBy(asc(schema.employees.department), asc(schema.employees.name));
      const g = await attendanceGrid(emps, `${m}-01`, last < today ? last : today < `${m}-01` ? `${m}-01` : today);
      return emps.map((e) => { const s = summarise(g.get(e.id)!); return [pid(ctx, e.id), e.name, e.department, e.category, s.present, s.late, s.half, s.leave, s.absent, s.working, s.pct]; });
    },
  },
  leave: {
    title: () => "Leave register", file: "leave-register", perm: ["employees", "attendance"],
    headers: () => ["Request", "Employee ID", "Name", "Department", "Leave type", "From", "To", "Days", "Status", "Applied on", "Reason"],
    rows: async (ctx) => {
      const st = ctx.p.get("status");
      const r = await db().select({ l: schema.leaveRequests, n: schema.employees.name, d: schema.employees.department }).from(schema.leaveRequests).leftJoin(schema.employees, eq(schema.employees.id, schema.leaveRequests.employeeId)).where(st ? eq(schema.leaveRequests.status, st) : undefined).orderBy(desc(schema.leaveRequests.fromDate));
      return r.map((x) => ["LV-" + x.l.id, pid(ctx, x.l.employeeId), x.n || "", x.d || "", x.l.type, x.l.fromDate, x.l.toDate, Number(x.l.days), x.l.status, fdt(x.l.appliedAt, ctx.tz), x.l.reason]);
    },
    imp: {
      headers: ["Employee ID", "Leave type", "From", "To", "Status", "Reason"],
      help: ["Existing employee ID", "Leave code from Master fields → Leave types (e.g. CL, EL)", DATEH, DATEH, "Approved, Pending or Rejected (blank = Approved)", "Optional"],
      types: { From: "date", To: "date" }, required: ["Employee ID", "Leave type", "From", "To"],
      prepare: async () => ({ emps: await empSet(), types: await act("leave") }),
      validate: (o, p, ctx) => {
        if (!p.emps.has(normId(o["Employee ID"], ctx.prefix))) return `Employee ID “${S(o["Employee ID"])}” not found`;
        if (!ci(p.types, o["Leave type"])) return `Leave type “${S(o["Leave type"])}” is not active`;
        if (!isDate(o.From) || !isDate(o.To)) return "From and To must be valid dates";
        if (S(o.To) < S(o.From)) return "To is before From";
        if (S(o.Status) && !/^(approved|pending|rejected)$/i.test(S(o.Status))) return "Status should be Approved, Pending or Rejected";
        return "";
      },
      commit: async (list, p, ctx) => {
        const count = await leaveCounter(), at = new Date().toISOString();
        const vals = list.map((o) => { const st = (S(o.Status) || "approved").toLowerCase(); return { employeeId: normId(o["Employee ID"], ctx.prefix), type: ci(p.types, o["Leave type"])!, fromDate: S(o.From), toDate: S(o.To), days: count(S(o.From), S(o.To)), reason: S(o.Reason) || "Imported record", status: st, chain: st === "pending" ? ["HR Office"] : [], level: 0, history: [{ level: "Import", by: ctx.u.name, action: "imported", at }] }; });
        for (let i = 0; i < vals.length; i += 500) await db().insert(schema.leaveRequests).values(vals.slice(i, i + 500));
        return `${list.length} leave record${list.length === 1 ? "" : "s"} added.`;
      },
    },
  },
  "leave-opening": {
    title: () => "Leave opening balances", file: "leave-opening-balances", perm: ["employees"],
    headers: () => ["Employee ID", "Name", "Leave type", "Leave year", "Opening balance"],
    rows: async (ctx) => (await db().select({ o: schema.leaveOpening, n: schema.employees.name }).from(schema.leaveOpening).leftJoin(schema.employees, eq(schema.employees.id, schema.leaveOpening.employeeId)).orderBy(asc(schema.leaveOpening.employeeId))).map((x) => [pid(ctx, x.o.employeeId), x.n || "", x.o.type, x.o.year, Number(x.o.opening)]),
    imp: {
      headers: ["Employee ID", "Leave type", "Leave year", "Opening balance"],
      help: ["Existing employee ID", "Leave code (e.g. EL)", "First year of the leave year, e.g. 2026 (for April 2026 – March 2027 use 2026)", "Days carried forward or credited, e.g. 45 or 2.5"],
      types: { "Leave year": "num", "Opening balance": "num" }, required: ["Employee ID", "Leave type", "Leave year", "Opening balance"],
      prepare: async () => ({ emps: await empSet(), types: await act("leave") }),
      validate: (o, p, ctx) => {
        if (!p.emps.has(normId(o["Employee ID"], ctx.prefix))) return `Employee ID “${S(o["Employee ID"])}” not found`;
        if (!ci(p.types, o["Leave type"])) return `Leave type “${S(o["Leave type"])}” is not active`;
        if (!/^\d{4}$/.test(S(o["Leave year"]))) return "Leave year should be a 4-digit year";
        if (isNaN(Number(o["Opening balance"]))) return "Opening balance must be a number";
        return "";
      },
      commit: async (list, p, ctx) => {
        const m = new Map<string, typeof schema.leaveOpening.$inferInsert>();
        for (const o of list) { const v = { employeeId: normId(o["Employee ID"], ctx.prefix), type: ci(p.types, o["Leave type"])!, year: Number(o["Leave year"]), opening: Number(o["Opening balance"]) }; m.set(`${v.employeeId}|${v.type}|${v.year}`, v); }
        const vals = [...m.values()];
        for (let i = 0; i < vals.length; i += 1000) await db().insert(schema.leaveOpening).values(vals.slice(i, i + 1000)).onConflictDoUpdate({ target: [schema.leaveOpening.employeeId, schema.leaveOpening.type, schema.leaveOpening.year], set: { opening: sql.raw("excluded.opening") } });
        return `${list.length} opening balance${list.length === 1 ? "" : "s"} saved.`;
      },
    },
  },
  salary: {
    title: () => "Salary structures", file: "salary-structures", perm: ["payroll"],
    headers: () => ["Employee ID", "Name", "Component", "Monthly amount"],
    rows: async (ctx) => (await db().select({ s: schema.salaryStructure, n: schema.employees.name }).from(schema.salaryStructure).leftJoin(schema.employees, eq(schema.employees.id, schema.salaryStructure.employeeId)).orderBy(asc(schema.salaryStructure.employeeId))).map((x) => [pid(ctx, x.s.employeeId), x.n || "", x.s.component, Number(x.s.amount)]),
    imp: {
      headers: ["Employee ID", "Component", "Monthly amount"],
      help: ["Existing employee ID", "Name of an active salary component. For components whose rule is Auto (PF, ESI) enter 1; payroll calculates them.", "Full-month amount in rupees. 0 removes the component from that employee."],
      types: { "Monthly amount": "num" }, required: ["Employee ID", "Component", "Monthly amount"],
      prepare: async () => ({ emps: await empSet(), comps: await act("sal") }),
      validate: (o, p, ctx) => {
        if (!p.emps.has(normId(o["Employee ID"], ctx.prefix))) return `Employee ID “${S(o["Employee ID"])}” not found`;
        if (!ci(p.comps, o.Component)) return `Component “${S(o.Component)}” is not an active salary component`;
        if (S(o["Monthly amount"]) === "" || isNaN(Number(o["Monthly amount"]))) return "Monthly amount must be a number";
        return "";
      },
      commit: async (list, p, ctx) => {
        const m = new Map<string, { employeeId: string; component: string; amount: number }>();
        for (const o of list) { const v = { employeeId: normId(o["Employee ID"], ctx.prefix), component: ci(p.comps, o.Component)!, amount: Number(o["Monthly amount"]) }; m.set(`${v.employeeId}|${v.component}`, v); }
        const all = [...m.values()], keep = all.filter((v) => v.amount), drop = all.filter((v) => !v.amount);
        for (let i = 0; i < keep.length; i += 1000) await db().insert(schema.salaryStructure).values(keep.slice(i, i + 1000)).onConflictDoUpdate({ target: [schema.salaryStructure.employeeId, schema.salaryStructure.component], set: { amount: sql.raw("excluded.amount") } });
        for (const v of drop) await db().delete(schema.salaryStructure).where(and(eq(schema.salaryStructure.employeeId, v.employeeId), eq(schema.salaryStructure.component, v.component)));
        return `${list.length} salary line${list.length === 1 ? "" : "s"} saved.`;
      },
    },
  },
  "pay-inputs": {
    title: (ctx) => `Payroll inputs, ${monthLabel(monthParam(ctx))}`, file: "payroll-inputs", perm: ["payroll"],
    headers: () => ["Employee ID", "Name", "Month", "Component", "Amount", "Remarks"],
    rows: async (ctx) => (await db().select({ i: schema.payInputs, n: schema.employees.name }).from(schema.payInputs).leftJoin(schema.employees, eq(schema.employees.id, schema.payInputs.employeeId)).where(eq(schema.payInputs.month, monthParam(ctx))).orderBy(asc(schema.payInputs.employeeId))).map((x) => [pid(ctx, x.i.employeeId), x.n || "", x.i.month, x.i.component, Number(x.i.amount), x.i.remarks]),
    imp: {
      headers: ["Employee ID", "Month", "Component", "Amount", "Remarks"],
      help: ["Existing employee ID", "YYYY-MM or e.g. Oct 2026", "An active salary component, or “LOP days” for loss-of-pay days", "Rupees (or number of days for LOP days)", "Optional"],
      types: { Amount: "num" }, required: ["Employee ID", "Month", "Component", "Amount"],
      prepare: async () => ({ emps: await empSet(), comps: [...(await act("sal")), "LOP days"], closed: new Set((await db().select().from(schema.payrollRuns)).filter((r) => r.step >= 2).map((r) => r.month)) }),
      validate: (o, p, ctx) => {
        if (!p.emps.has(normId(o["Employee ID"], ctx.prefix))) return `Employee ID “${S(o["Employee ID"])}” not found`;
        const m = normMonth(o.Month);
        if (!m) return "Month should be YYYY-MM or like Oct 2026";
        if (p.closed.has(m)) return `Payroll for ${monthLabel(m)} is already past HR review`;
        if (!ci(p.comps, o.Component)) return `Component “${S(o.Component)}” is not an active salary component`;
        if (S(o.Amount) === "" || isNaN(Number(o.Amount))) return "Amount must be a number";
        return "";
      },
      commit: async (list, p, ctx) => {
        await db().insert(schema.payInputs).values(list.map((o) => ({ employeeId: normId(o["Employee ID"], ctx.prefix), month: normMonth(o.Month), component: ci(p.comps, o.Component)!, amount: Number(o.Amount), remarks: S(o.Remarks) })));
        return `${list.length} payroll input${list.length === 1 ? "" : "s"} added. Recompute the payroll to include them.`;
      },
    },
  },
  "payroll-register": {
    title: (ctx) => `Payroll register, ${monthLabel(monthParam(ctx))}`, file: "payroll-register", perm: ["payroll"],
    headers: async (ctx) => {
      const L = await db().select().from(schema.payrollLines).where(eq(schema.payrollLines.month, monthParam(ctx)));
      const e = [...new Set(L.flatMap((l) => l.data.earnings.map((x) => x[0])))], d = [...new Set(L.flatMap((l) => l.data.deductions.map((x) => x[0])))];
      return ["Employee ID", "Name", "Department", "Paid days", ...e, "Gross", ...d, "Total deductions", "Net pay"];
    },
    rows: async (ctx) => {
      const L = await db().select({ l: schema.payrollLines, e: schema.employees }).from(schema.payrollLines).leftJoin(schema.employees, eq(schema.employees.id, schema.payrollLines.employeeId)).where(eq(schema.payrollLines.month, monthParam(ctx))).orderBy(asc(schema.payrollLines.employeeId));
      const e = [...new Set(L.flatMap((l) => l.l.data.earnings.map((x) => x[0])))], d = [...new Set(L.flatMap((l) => l.l.data.deductions.map((x) => x[0])))];
      const rows: Cell[][] = L.map(({ l, e: emp }) => [pid(ctx, l.employeeId), emp?.name || "", emp?.department || "", l.data.paidDays, ...e.map((n) => l.data.earnings.find((x) => x[0] === n)?.[1] || 0), l.data.gross, ...d.map((n) => l.data.deductions.find((x) => x[0] === n)?.[1] || 0), l.data.ded, l.data.net]);
      if (rows.length) { const tot: Cell[] = ["", `Total (${rows.length} employees)`, "", ""]; for (let i = 4; i < rows[0].length; i++) tot.push(rows.reduce((s, r) => s + Number(r[i] || 0), 0)); rows.push(tot); }
      return rows;
    },
  },
  "bank-file": {
    title: (ctx) => `Salary bank transfer list, ${monthLabel(monthParam(ctx))}`, file: "bank-transfer", perm: ["payroll"],
    headers: () => ["Employee ID", "Name", "Bank account", "IFSC", "Net pay"],
    rows: async (ctx) => (await db().select({ l: schema.payrollLines, e: schema.employees }).from(schema.payrollLines).leftJoin(schema.employees, eq(schema.employees.id, schema.payrollLines.employeeId)).where(eq(schema.payrollLines.month, monthParam(ctx))).orderBy(asc(schema.payrollLines.employeeId))).map(({ l, e }) => [pid(ctx, l.employeeId), e?.name || "", e?.bankAccount || "MISSING", e?.ifsc || "MISSING", l.data.net]),
  },
  candidates: {
    title: () => "Candidates", file: "candidates", perm: ["recruitment"],
    headers: () => ["Requisition", "Position", "Department", "Candidate", "Mobile", "Qualification / experience", "Stage"],
    rows: async () => (await db().select({ c: schema.candidates, r: schema.requisitions }).from(schema.candidates).leftJoin(schema.requisitions, eq(schema.requisitions.id, schema.candidates.requisitionId)).orderBy(asc(schema.candidates.requisitionId), desc(schema.candidates.stage))).map(({ c, r }) => [c.requisitionId, r?.title || "", r?.department || "", c.name, c.mobile, c.details, c.stage < 0 ? "Not selected" : STAGES[c.stage]]),
    imp: {
      headers: ["Requisition", "Candidate name", "Mobile", "Qualification / experience"],
      help: ["Requisition ID, e.g. RQ-101", "Full name", "Optional", "Optional"], required: ["Requisition", "Candidate name"],
      prepare: async () => ({ reqs: (await db().select({ id: schema.requisitions.id }).from(schema.requisitions)).map((r) => r.id) }),
      validate: (o, p) => (!ci(p.reqs, o.Requisition) ? `Requisition “${S(o.Requisition)}” not found` : !S(o["Candidate name"]) ? "Candidate name is required" : ""),
      commit: async (list, p) => { await db().insert(schema.candidates).values(list.map((o) => ({ requisitionId: ci(p.reqs, o.Requisition)!, name: S(o["Candidate name"]), mobile: S(o.Mobile), details: S(o["Qualification / experience"]) }))); return `${list.length} candidate${list.length === 1 ? "" : "s"} added at the Applied stage.`; },
    },
  },
  onboarding: {
    title: () => "Onboarding status", file: "onboarding", perm: ["recruitment"],
    headers: () => ["Joiner", "Role", "Joining date", "Checklist item", "Done"],
    rows: async () => {
      const items = (await getMasters()).docs.filter((r) => r.active);
      return (await db().select().from(schema.joiners).orderBy(desc(schema.joiners.joinDate))).flatMap((j) => items.filter((r) => r.data[1] === "All" || r.data[1] === j.kind).map((r) => [j.name, j.roleText, j.joinDate || "", String(r.data[0]), j.done[String(r.data[0])] ? "Yes" : "No"]));
    },
  },
  users: {
    title: () => "User accounts", file: "user-accounts", perm: "admin",
    headers: () => ["Login ID", "Name", "Role", "Status", "Must set password", "Last sign-in"],
    rows: async (ctx) => (await db().select().from(schema.users).orderBy(asc(schema.users.login))).map((u) => [u.login === "ADMIN" ? "admin" : pid(ctx, u.login), u.name, ROLES[u.role as Role] || u.role, u.status, u.mustChange ? "Yes" : "No", fdt(u.lastLogin, ctx.tz)]),
  },
  audit: {
    title: () => "Change log", file: "change-log", perm: "admin",
    headers: () => ["When", "Who", "What changed"],
    rows: async (ctx) => (await db().select().from(schema.audit).orderBy(desc(schema.audit.at)).limit(10000)).map((a) => [fdt(a.at, ctx.tz), a.who, a.action]),
  },
};

for (const m of MASTERS) {
  const opts = (t: string | undefined, cats: string[]) => (t?.startsWith("sel:") ? t.slice(4).split("|").flatMap((x) => (x === "@cat" ? cats : [x])) : null);
  DATASETS["master-" + m.kind] = {
    title: () => m.title, file: m.title.toLowerCase().replace(/[^a-z0-9]+/g, "-"), perm: ["masters"],
    headers: () => [...m.cols.map((c) => c.label), "Active"],
    rows: async () => ((await getMasters())[m.kind] || []).map((r) => [...m.cols.map((_, i) => r.data[i] ?? ""), r.active ? "Yes" : "No"]),
    imp: {
      headers: [...m.cols.map((c) => c.label), "Active"],
      help: [...m.cols.map((c, i) => (i === 0 ? "Required. A row that matches an existing entry updates it. " : "") + (c.help || (c.type?.startsWith("sel:") ? "One of the listed options (see the form on the page)" : c.type === "num" ? "Number" : c.type === "date" ? DATEH : c.type === "time" ? "Time as HH:MM, 24-hour" : "Text"))), "Yes or No (blank means Yes)"],
      types: Object.fromEntries(m.cols.filter((c) => c.type === "num" || c.type === "date" || c.type === "time").map((c) => [c.label, c.type as "num" | "date" | "time"])),
      required: m.cols.filter((c) => c.required).map((c) => c.label),
      prepare: async () => ({ cats: await act("cat"), rows: (await getMasters())[m.kind] || [] }),
      validate: (o, p) => {
        for (const c of m.cols) {
          const v = o[c.label], op = opts(c.type, p.cats);
          if (c.required && !S(v)) return `${c.label} is required`;
          if (op && S(v) && !ci(op, v)) return `${c.label} “${S(v)}” is not allowed. Use one of: ${op.join(", ")}`;
          if (c.type === "num" && S(v) && isNaN(Number(v))) return `${c.label} must be a number`;
          if (c.type === "date" && S(v) && !isDate(v)) return `${c.label} is not a valid date`;
          if (c.type === "time" && S(v) && !isTime(v)) return `${c.label} should be HH:MM`;
        }
        if (S(o.Active) && !/^(yes|no|y|n)$/i.test(S(o.Active))) return "Active should be Yes or No";
        return "";
      },
      commit: async (list, p) => {
        let a = 0, up = 0;
        const rows: { id: number; data: Cell[] }[] = p.rows;
        for (const o of list) {
          const data = m.cols.map((c) => { const v = o[c.label]; const op = opts(c.type, p.cats); if (op) return ci(op, v) || ""; if (c.type === "num") return S(v) === "" ? 0 : Number(v); if (c.key === "head") return S(v).toUpperCase(); return S(v); });
          const active = !/^n/i.test(S(o.Active));
          const ex = rows.find((r) => String(r.data[0]).toLowerCase() === String(data[0]).toLowerCase());
          if (ex) { await db().update(schema.masters).set({ data, active }).where(eq(schema.masters.id, ex.id)); ex.data = data; up++; }
          else { const ins = await db().insert(schema.masters).values({ kind: m.kind, data, active, sort: 1000 + a }).returning({ id: schema.masters.id }); rows.push({ id: ins[0].id, data }); a++; }
        }
        return `${a} added, ${up} updated in ${m.title}.`;
      },
    },
  };
}

export async function dsAllowed(ds: DataSet, u: SessionUser, mode: "export" | "import") {
  const { can } = await import("./auth");
  if (ds.perm === "admin") { if (u.role !== "admin") return false; }
  else { let ok = false; for (const p of ds.perm) if (await can(u, p)) ok = true; if (!ok) return false; }
  return can(u, mode);
}
export async function ctxFor(u: SessionUser, p: URLSearchParams): Promise<Ctx> {
  const { org } = await getSettings();
  return { u, p, prefix: org.prefix, tz: org.tz };
}

export async function barFor(u: SessionUser, key: string) {
  const ds = DATASETS[key];
  if (!ds) return { canImport: false, canExport: false };
  return { canImport: !!ds.imp && (await dsAllowed(ds, u, "import")), canExport: await dsAllowed(ds, u, "export") };
}
