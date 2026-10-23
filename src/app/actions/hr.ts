"use server";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requirePerm, who } from "@/lib/auth";
import { activeList, getSettings } from "@/lib/settings";
import { computePayroll } from "@/lib/logic";
import { EMP_STATUS } from "@/lib/config";
import { isDate, monthLabel } from "@/lib/dates";
import { log } from "@/lib/audit";

const go = (path: string, k: "ok" | "err", m: string): never => redirect(`${path}${path.includes("?") ? "&" : "?"}${k}=${encodeURIComponent(m)}`);
const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

/* ---------------- employees ---------------- */
export async function saveEmployee(fd: FormData) {
  const u = await requirePerm("employees");
  const { org } = await getSettings();
  const isNew = fd.get("isNew") === "1";
  let id = s(fd, "id").toUpperCase();
  if (id.startsWith(org.prefix.toUpperCase() + "-")) id = id.slice(org.prefix.length + 1);
  const back = isNew ? "/employees/new" : `/employees/${id}`;
  if (!/^[A-Z0-9]{1,4}-[A-Z0-9]{1,8}$/.test(id)) go(back, "err", "Employee ID should look like F-1042 (category code, dash, number).");
  const v = { name: s(fd, "name"), designation: s(fd, "designation"), department: s(fd, "department"), category: s(fd, "category"), doj: s(fd, "doj") || null, status: s(fd, "status") || "Active", shift: s(fd, "shift") || null, mobile: s(fd, "mobile") || null, email: s(fd, "email") || null, pan: s(fd, "pan").toUpperCase() || null, uan: s(fd, "uan") || null, bankAccount: s(fd, "bankAccount") || null, ifsc: s(fd, "ifsc").toUpperCase() || null };
  if (!v.name) go(back, "err", "Full name is required.");
  if (!(await activeList("desig")).includes(v.designation)) go(back, "err", "Pick a designation from the list.");
  if (!(await activeList("dept")).includes(v.department)) go(back, "err", "Pick a department from the list.");
  if (!(await activeList("cat")).includes(v.category)) go(back, "err", "Pick a category from the list.");
  if (v.doj && !isDate(v.doj)) go(back, "err", "Date of joining is not valid.");
  if (!EMP_STATUS.includes(v.status)) go(back, "err", "Pick a valid status.");
  if (isNew) {
    const ex = await db().select({ id: schema.employees.id }).from(schema.employees).where(eq(schema.employees.id, id));
    if (ex.length) go(back, "err", `Employee ID ${id} already exists.`);
    await db().insert(schema.employees).values({ id, ...v });
    await log(who(u), `Added employee ${id} ${v.name}`);
  } else {
    await db().update(schema.employees).set(v).where(eq(schema.employees.id, id));
    await db().update(schema.users).set({ name: v.name, ...(v.status === "Exited" ? { status: "Disabled" } : {}) }).where(eq(schema.users.login, id));
    await log(who(u), `Updated employee ${id} ${v.name}${v.status === "Exited" ? " (exited; login disabled)" : ""}`);
  }
  go(`/employees/${id}`, "ok", isNew ? "Employee added. The Master Admin can now create their login." : "Saved.");
}

export async function setSalary(fd: FormData) {
  const u = await requirePerm("payroll");
  const id = s(fd, "id"), comp = s(fd, "component"), amount = Number(s(fd, "amount"));
  if (!(await activeList("sal")).includes(comp)) go(`/employees/${id}`, "err", "Pick a salary component.");
  if (isNaN(amount) || amount < 0) go(`/employees/${id}`, "err", "Amount must be a positive number.");
  if (!amount) await db().delete(schema.salaryStructure).where(and(eq(schema.salaryStructure.employeeId, id), eq(schema.salaryStructure.component, comp)));
  else await db().insert(schema.salaryStructure).values({ employeeId: id, component: comp, amount }).onConflictDoUpdate({ target: [schema.salaryStructure.employeeId, schema.salaryStructure.component], set: { amount } });
  await log(who(u), `Salary structure of ${id}: ${comp} set to ${amount}`);
  go(`/employees/${id}#salary`, "ok", "Salary structure updated.");
}

/* ---------------- payroll ---------------- */
const STEP_NAMES = ["Not started", "Computed", "HR reviewed", "Accounts approved", "Closed and released"];
export async function payrollAction(fd: FormData) {
  const u = await requirePerm("payroll");
  const m = s(fd, "month"), act = s(fd, "act");
  const back = `/payroll?m=${m}`;
  if (!/^\d{4}-\d{2}$/.test(m)) go("/payroll", "err", "Pick a month.");
  const run = (await db().select().from(schema.payrollRuns).where(eq(schema.payrollRuns.month, m)))[0] || { month: m, step: 0, history: [] };
  const hist = (a: string) => [...run.history, { level: STEP_NAMES[run.step], by: u.name, action: a === "compute" ? "computed" : a === "reopen" ? "reopened" : STEP_NAMES[step].toLowerCase(), at: new Date().toISOString() }];
  let step = run.step;
  if (act === "compute") {
    if (run.step >= 2) go(back, "err", "This payroll is past HR review. Reopen it first to recompute.");
    const n = await computePayroll(m);
    if (!n) go(back, "err", "No employee has a salary structure yet. Add structures on employee pages or import them.");
    step = 1;
    await log(who(u), `Computed payroll for ${monthLabel(m)} (${n} employees)`);
  } else if (act === "next") {
    if (run.step < 1 || run.step >= 4) go(back, "err", "Nothing to move forward.");
    if (run.step === 2 && u.role !== "accounts" && u.role !== "admin") go(back, "err", "Accounts approves this step.");
    step = run.step + 1;
    await log(who(u), `Payroll ${monthLabel(m)}: ${STEP_NAMES[step]}`);
  } else if (act === "reopen") {
    if (run.step === 0 || (run.step >= 4 && u.role !== "admin")) go(back, "err", "Only the Master Admin can reopen a closed payroll.");
    step = 1;
    await log(who(u), `Reopened payroll for ${monthLabel(m)}`);
  }
  await db().insert(schema.payrollRuns).values({ month: m, step, history: hist(act) }).onConflictDoUpdate({ target: schema.payrollRuns.month, set: { step, history: hist(act), updatedAt: new Date() } });
  go(back, "ok", act === "compute" ? "Payroll computed. Check the register, then mark it HR reviewed." : step === 4 ? "Payroll closed. Payslips are now visible to staff." : `Marked ${STEP_NAMES[step]}.`);
}
export async function addPayInput(fd: FormData) {
  const u = await requirePerm("payroll");
  const { org } = await getSettings();
  const m = s(fd, "month");
  let id = s(fd, "employeeId").toUpperCase();
  if (id.startsWith(org.prefix.toUpperCase() + "-")) id = id.slice(org.prefix.length + 1);
  const comp = s(fd, "component"), amount = Number(s(fd, "amount"));
  const back = `/payroll?m=${m}`;
  const emp = await db().select({ id: schema.employees.id }).from(schema.employees).where(eq(schema.employees.id, id));
  if (!emp.length) go(back, "err", `Employee ID ${id} not found.`);
  if (isNaN(amount)) go(back, "err", "Amount must be a number.");
  await db().insert(schema.payInputs).values({ month: m, employeeId: id, component: comp, amount, remarks: s(fd, "remarks") });
  await log(who(u), `Added payroll input for ${id} (${m}): ${comp} ${amount}`);
  go(back, "ok", "Input added. Recompute the payroll to include it.");
}
export async function deletePayInput(fd: FormData) {
  const u = await requirePerm("payroll");
  const id = Number(fd.get("id")), m = s(fd, "month");
  await db().delete(schema.payInputs).where(eq(schema.payInputs.id, id));
  await log(who(u), `Removed payroll input #${id}`);
  go(`/payroll?m=${m}`, "ok", "Input removed.");
}

/* ---------------- recruitment & onboarding ---------------- */
export async function addRequisition(fd: FormData) {
  const u = await requirePerm("recruitment");
  const title = s(fd, "title"), department = s(fd, "department"), posts = Math.max(1, Number(s(fd, "posts")) || 1);
  if (!title || !department) go("/recruitment", "err", "Position and department are required.");
  const n = await db().select({ c: sql<number>`count(*)` }).from(schema.requisitions);
  const id = `RQ-${101 + Number(n[0].c)}`;
  await db().insert(schema.requisitions).values({ id, title, department, posts, note: s(fd, "note") });
  await log(who(u), `Opened requisition ${id}: ${posts} × ${title}, ${department}`);
  go(`/recruitment?r=${id}`, "ok", `Requisition ${id} opened.`);
}
export async function setRequisitionStatus(fd: FormData) {
  const u = await requirePerm("recruitment");
  const id = s(fd, "id"), status = s(fd, "status") === "Closed" ? "Closed" : "Open";
  await db().update(schema.requisitions).set({ status }).where(eq(schema.requisitions.id, id));
  await log(who(u), `${status === "Closed" ? "Closed" : "Reopened"} requisition ${id}`);
  go(`/recruitment?r=${id}`, "ok", `Requisition ${status === "Closed" ? "closed" : "reopened"}.`);
}
export async function addCandidate(fd: FormData) {
  const u = await requirePerm("recruitment");
  const r = s(fd, "requisitionId"), name = s(fd, "name");
  if (!name) go(`/recruitment?r=${r}`, "err", "Candidate name is required.");
  await db().insert(schema.candidates).values({ requisitionId: r, name, mobile: s(fd, "mobile"), details: s(fd, "details") });
  await log(who(u), `Added candidate ${name} to ${r}`);
  go(`/recruitment?r=${r}`, "ok", "Candidate added.");
}
export async function moveCandidate(fd: FormData) {
  const u = await requirePerm("recruitment");
  const id = Number(fd.get("id")), stage = Number(fd.get("stage"));
  const c = (await db().select().from(schema.candidates).where(eq(schema.candidates.id, id)))[0];
  if (!c) go("/recruitment", "err", "Candidate not found.");
  await db().update(schema.candidates).set({ stage }).where(eq(schema.candidates.id, id));
  await log(who(u), `Moved candidate ${c!.name} (${c!.requisitionId}) to stage ${stage}`);
  go(`/recruitment?r=${c!.requisitionId}`, "ok", stage < 0 ? `${c!.name} marked not selected.` : `${c!.name} moved.`);
}
export async function startOnboarding(fd: FormData) {
  const u = await requirePerm("recruitment");
  const id = Number(fd.get("id"));
  const c = (await db().select().from(schema.candidates).where(eq(schema.candidates.id, id)))[0];
  const r = c && (await db().select().from(schema.requisitions).where(eq(schema.requisitions.id, c.requisitionId)))[0];
  if (!c || !r) go("/recruitment", "err", "Candidate not found.");
  const kind = /nurs/i.test(r!.title + r!.department) ? "Nursing" : /^dr\.?\s|professor|resident|tutor/i.test(c!.name + " " + r!.title) ? "Doctors" : /techn|pharm|radiog|lab/i.test(r!.title) ? "Paramedical" : "All";
  await db().insert(schema.joiners).values({ name: c!.name, roleText: `${r!.title} · ${r!.department}`, kind, joinDate: s(fd, "joinDate") || null });
  await log(who(u), `Started onboarding for ${c!.name}`);
  go("/onboarding", "ok", `${c!.name} added to onboarding.`);
}
export async function addJoiner(fd: FormData) {
  const u = await requirePerm("recruitment");
  const name = s(fd, "name");
  if (!name) go("/onboarding", "err", "Name is required.");
  await db().insert(schema.joiners).values({ name, roleText: s(fd, "roleText"), kind: s(fd, "kind") || "All", joinDate: s(fd, "joinDate") || null });
  await log(who(u), `Added joiner ${name}`);
  go("/onboarding", "ok", "Joiner added.");
}
export async function tickJoiner(fd: FormData) {
  const u = await requirePerm("recruitment");
  const id = Number(fd.get("id")), item = s(fd, "item"), on = fd.get("on") === "1";
  const j = (await db().select().from(schema.joiners).where(eq(schema.joiners.id, id)))[0];
  if (!j) go("/onboarding", "err", "Joiner not found.");
  await db().update(schema.joiners).set({ done: { ...j!.done, [item]: on } }).where(eq(schema.joiners.id, id));
  await log(who(u), `Onboarding ${j!.name}: “${item}” ${on ? "done" : "not done"}`);
  go(`/onboarding#j${id}`, "ok", "Updated.");
}
export async function removeJoiner(fd: FormData) {
  const u = await requirePerm("recruitment");
  const id = Number(fd.get("id"));
  await db().delete(schema.joiners).where(eq(schema.joiners.id, id));
  await log(who(u), `Removed joiner #${id} from onboarding`);
  go("/onboarding", "ok", "Removed from onboarding.");
}
