"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requirePerm, hashPassword, tempPassword, who } from "@/lib/auth";
import { activeList, activeRows, getSettings } from "@/lib/settings";
import { isDate } from "@/lib/dates";
import { log } from "@/lib/audit";
import { employeeRoom } from "@/lib/license";
import { mobile10, SECTIONS, type Exp } from "@/lib/joinform";
import { sha256 } from "@/lib/secure";
import { newToken, baseUrl, OPEN_STATES, shownStatus, dropFiles, type Invite } from "@/lib/joiners";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const go = (path: string, k: "ok" | "err", m: string): never => redirect(`${path}${path.includes("?") ? "&" : "?"}${k}=${encodeURIComponent(m)}`);
export type LinkState = { id?: number; link?: string; name?: string; mobile?: string; email?: string; expires?: string; org?: string; err?: string } | null;
export type ApproveState = { err?: string; empId?: string; login?: string; pw?: string; name?: string } | null;

const step = (u: { name: string }, action: string, note?: string) => ({ level: "HR", by: u.name, action, at: new Date().toISOString(), ...(note ? { note } : {}) });
const expiry = (days: number) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(23, 59, 59, 0); return d; };
const daysOf = (fd: FormData) => [3, 7, 14, 30].includes(Number(s(fd, "days"))) ? Number(s(fd, "days")) : 7;
async function load(id: number) { return (await db().select().from(schema.joinerInvites).where(eq(schema.joinerInvites.id, id)))[0] as Invite | undefined; }
async function result(inv: Pick<Invite, "id" | "name" | "mobile" | "email">, token: string, expires: Date): Promise<LinkState> {
  const { org } = await getSettings();
  return { id: inv.id, link: `${await baseUrl()}/join/${token}`, name: inv.name, mobile: inv.mobile, email: inv.email, expires: expires.toISOString(), org: org.name };
}

export async function createInvite(_: LinkState, fd: FormData): Promise<LinkState> {
  const u = await requirePerm("employees");
  const v = { name: s(fd, "name"), mobile: s(fd, "mobile"), email: s(fd, "email"), category: s(fd, "category"), department: s(fd, "department"), designation: s(fd, "designation"), shift: s(fd, "shift") || null, joinDate: s(fd, "joinDate") || null };
  if (!v.name) return { err: "Enter the joiner's name." };
  if (v.mobile && !mobile10(v.mobile)) return { err: "Mobile should be a 10-digit number." };
  if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) return { err: "Check the email address." };
  if (!(await activeList("cat")).includes(v.category)) return { err: "Pick a category." };
  if (!(await activeList("dept")).includes(v.department)) return { err: "Pick a department." };
  if (!(await activeList("desig")).includes(v.designation)) return { err: "Pick a designation." };
  if (v.shift && !(await activeList("shift")).includes(v.shift)) return { err: "Pick a shift." };
  if (v.joinDate && !isDate(v.joinDate)) return { err: "Joining date is not valid." };
  const token = newToken(), expiresAt = expiry(daysOf(fd));
  const [row] = await db().insert(schema.joinerInvites).values({ ...v, mobile: mobile10(v.mobile) || "", tokenHash: sha256(token), expiresAt, createdBy: who(u), history: [step(u, "sent link")] }).returning();
  await log(who(u), `Created joining-form link for ${v.name} (${v.designation}, ${v.department})`);
  // No revalidate here: it would re-render the page and lose the one-time link shown to HR.
  return result(row, token, expiresAt);
}

/** New link for the same joiner. From "submitted" it asks for corrections (a note is required); otherwise it replaces a lost or expired link. */
export async function reissueLink(_: LinkState, fd: FormData): Promise<LinkState> {
  const u = await requirePerm("employees");
  const inv = await load(Number(fd.get("id")));
  if (!inv) return { err: "Not found." };
  const note = s(fd, "note").slice(0, 500);
  const fix = inv.status === "submitted";
  if (!fix && !(OPEN_STATES as readonly string[]).includes(inv.status)) return { err: "This joiner is already closed." };
  if (fix && !note) return { err: "Write what needs fixing. The joiner sees this note." };
  const token = newToken(), expiresAt = expiry(daysOf(fd));
  await db().update(schema.joinerInvites).set({ tokenHash: sha256(token), expiresAt, ...(fix ? { status: "corrections", note, checks: {} } : {}), history: [...inv.history, step(u, fix ? "asked for corrections" : "sent a new link", note)] }).where(eq(schema.joinerInvites.id, inv.id));
  await log(who(u), `${fix ? "Asked for corrections from" : "New joining-form link for"} ${inv.name} (#${inv.id})`);
  return result(inv, token, expiresAt);
}

export async function toggleCheck(fd: FormData) {
  await requirePerm("employees");
  const inv = await load(Number(fd.get("id"))), k = s(fd, "k");
  if (!inv || inv.status !== "submitted" || !(SECTIONS as readonly string[]).includes(k)) go("/joiners", "err", "Not available.");
  await db().update(schema.joinerInvites).set({ checks: { ...inv!.checks, [k]: !inv!.checks[k] } }).where(eq(schema.joinerInvites.id, inv!.id));
  revalidatePath(`/joiners/${inv!.id}`);
  redirect(`/joiners/${inv!.id}#${k}`);
}

export async function cancelInvite(fd: FormData) {
  const u = await requirePerm("employees");
  const inv = await load(Number(fd.get("id")));
  if (!inv || !(OPEN_STATES as readonly string[]).includes(inv.status)) go("/joiners", "err", "This link is not open.");
  await db().update(schema.joinerInvites).set({ status: "cancelled", tokenHash: null, history: [...inv!.history, step(u, "cancelled the link")] }).where(eq(schema.joinerInvites.id, inv!.id));
  await log(who(u), `Cancelled joining-form link for ${inv!.name} (#${inv!.id})`);
  go(`/joiners/${inv!.id}`, "ok", "Link cancelled. It no longer opens.");
}

export async function rejectInvite(fd: FormData) {
  const u = await requirePerm("employees");
  const inv = await load(Number(fd.get("id"))), reason = s(fd, "reason").slice(0, 500);
  if (!inv || ["accepted", "rejected"].includes(inv.status)) go("/joiners", "err", "Not available.");
  if (!reason) go(`/joiners/${inv!.id}`, "err", "Give a reason for rejecting.");
  await db().update(schema.joinerInvites).set({ status: "rejected", tokenHash: null, note: reason, history: [...inv!.history, step(u, "rejected", reason)] }).where(eq(schema.joinerInvites.id, inv!.id));
  await log(who(u), `Rejected joiner ${inv!.name} (#${inv!.id}): ${reason}`);
  go(`/joiners/${inv!.id}`, "ok", "Rejected. You can delete the submitted details and documents when you no longer need them.");
}

export async function deleteInvite(fd: FormData) {
  const u = await requirePerm("employees");
  const inv = await load(Number(fd.get("id")));
  if (!inv) go("/joiners", "err", "Not found.");
  const st = shownStatus(inv!);
  if (!["rejected", "cancelled", "expired"].includes(st)) go(`/joiners/${inv!.id}`, "err", "Only rejected, cancelled or expired entries can be deleted.");
  await dropFiles(inv!.id);
  await db().delete(schema.joinerInvites).where(eq(schema.joinerInvites.id, inv!.id));
  await log(who(u), `Deleted joiner entry ${inv!.name} (#${inv!.id}) with its details and documents`);
  go("/joiners", "ok", `${inv!.name}'s details and documents were deleted.`);
}

export async function approveInvite(_: ApproveState, fd: FormData): Promise<ApproveState> {
  const u = await requirePerm("employees");
  const { org } = await getSettings();
  const inv = await load(Number(fd.get("id")));
  if (!inv || inv.status !== "submitted") return { err: "This joiner is not waiting for approval." };
  if (SECTIONS.some((k) => !inv.checks[k])) return { err: "Tick all five sections as checked first." };
  let id = s(fd, "empId").toUpperCase();
  if (id.startsWith(org.prefix.toUpperCase() + "-")) id = id.slice(org.prefix.length + 1);
  if (!/^[A-Z0-9]{1,4}-[A-Z0-9]{1,8}$/.test(id)) return { err: "Employee ID should look like N-0327 (category code, dash, number)." };
  if ((await db().select({ id: schema.employees.id }).from(schema.employees).where(eq(schema.employees.id, id))).length) return { err: `Employee ID ${id} is already taken.` };
  const v = { designation: s(fd, "designation"), department: s(fd, "department"), category: s(fd, "category"), shift: s(fd, "shift") || null, doj: s(fd, "doj") || null };
  if (!(await activeList("desig")).includes(v.designation)) return { err: "Pick a designation." };
  if (!(await activeList("dept")).includes(v.department)) return { err: "Pick a department." };
  if (!(await activeList("cat")).includes(v.category)) return { err: "Pick a category." };
  if (v.shift && !(await activeList("shift")).includes(v.shift)) return { err: "Pick a shift." };
  if (v.doj && !isDate(v.doj)) return { err: "Date of joining is not valid." };
  let rep = s(fd, "reportingTo").toUpperCase();
  if (rep.startsWith(org.prefix.toUpperCase() + "-")) rep = rep.slice(org.prefix.length + 1);
  if (rep && !(await db().select({ id: schema.employees.id }).from(schema.employees).where(eq(schema.employees.id, rep))).length) return { err: `Reporting manager ${rep} is not an employee.` };
  const room = await employeeRoom(1);
  if (room) return { err: room };

  const d = inv.data as Record<string, string> & { experience?: Exp[] };
  const name = d.fullName || inv.name;
  const files = await db().select({ id: schema.files.id, kind: schema.files.kind }).from(schema.files).where(eq(schema.files.inviteId, inv.id));
  const photo = files.find((f) => /photo/i.test(f.kind));
  await db().insert(schema.employees).values({
    id, name, ...v, status: "Probation", mobile: mobile10(d.mobile) || inv.mobile || null, email: d.email || inv.email || null,
    pan: d.pan || null, uan: (d.uan || "").replace(/\D/g, "") || null, bankAccount: (d.bankAccount || "").replace(/\D/g, "") || null, ifsc: d.ifsc || null,
    dob: d.dob || null, gender: d.gender || null, fatherName: d.fatherName || null, bloodGroup: d.bloodGroup || null, maritalStatus: d.maritalStatus || null,
    address: d.address || null, permAddress: d.permAddress || d.address || null, emergencyName: d.emergencyName || null, emergencyRelation: d.emergencyRelation || null,
    emergencyMobile: mobile10(d.emergencyMobile) || null, aadhaarEnc: d.aadhaarEnc || null, aadhaarLast4: d.aadhaarLast4 || null,
    qualification: d.qualification || null, institution: d.institution || null, qualYear: d.qualYear || null, regCouncil: d.regCouncil || null, regNo: d.regNo || null,
    reportingTo: rep || null, experience: d.experience || [], photoFileId: photo?.id ?? null,
  });
  await db().update(schema.files).set({ employeeId: id }).where(eq(schema.files.inviteId, inv.id));

  let pw = "";
  const wantLogin = fd.get("login") === "1" && !(await db().select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.login, id))).length;
  if (wantLogin) { pw = tempPassword(); await db().insert(schema.users).values({ login: id, employeeId: id, name, role: "staff", passwordHash: await hashPassword(pw), mustChange: true }); }

  if (fd.get("checklist") === "1") {
    // Sections HR has just verified count as done on the joining checklist; so does the login if one was made.
    const items = (await activeRows("docs")).filter((r) => r.data[1] === "All" || r.data[1] === v.category).map((r) => String(r.data[0]));
    const done = Object.fromEntries(items.filter((k) => /verif|document|degree|certificate|bank|uan/i.test(k) || (pw && /login/i.test(k))).map((k) => [k, true]));
    await db().insert(schema.joiners).values({ name, roleText: `${v.designation} · ${v.department}`, kind: v.category, joinDate: v.doj, done, employeeId: id });
  }
  await db().update(schema.joinerInvites).set({ status: "accepted", employeeId: id, tokenHash: null, history: [...inv.history, step(u, `approved as ${id}`)] }).where(eq(schema.joinerInvites.id, inv.id));
  await log(who(u), `Approved joiner ${name} as employee ${id}${pw ? " and created a staff login" : ""}`);
  return { empId: id, login: `${org.prefix}-${id}`, pw, name };
}
