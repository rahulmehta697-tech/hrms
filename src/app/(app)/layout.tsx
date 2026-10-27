import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser, can } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { actionable, departmentsHeadedBy } from "@/lib/logic";
import { countToVerify } from "@/lib/joiners";
import { ROLES, type Role } from "@/lib/config";
import { logout } from "@/app/actions/auth";
import Nav, { type NavData, type NavGroup, type NavLink } from "@/components/Nav";
import { Mark } from "@/components/ui";
import Powered from "@/components/Powered";
import { licenceStatus } from "@/lib/license";
import { DEMO, DEMO_RESET_TIME } from "@/lib/demo";
import { resetDemo } from "@/app/actions/demo";
import { Confirm } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser();
  const { org } = await getSettings();
  const lic = await licenceStatus();
  if (lic.state === "expired" && u.role !== "admin") {
    return (
      <div className="auth"><div className="card stack"><Mark org={org} big /><h1>Licence expired</h1><p className="muted" style={{ margin: 0 }}>This portal&apos;s licence has expired, so it is paused for everyone except the Master Admin. Please contact your HR office.</p><form action={logout}><button className="btn" type="submit">Sign out</button></form></div><div style={{ marginTop: 16 }}><Powered center /></div></div>
    );
  }
  const near = Number.isFinite(lic.limit) && lic.employees >= lic.limit * 0.9;
  const banner = lic.state === "grace" ? lic.message
    : u.role === "admin" && (lic.state !== "valid" || near) ? (near && lic.state === "valid" ? `${lic.employees.toLocaleString("en-IN")} of ${lic.limit.toLocaleString("en-IN")} licensed employees used.` : lic.message) : "";
  const P = async (p: Parameters<typeof can>[1]) => can(u, p);
  const top: NavLink[] = [], bottom: NavLink[] = [];
  top.push({ href: u.role === "admin" && !u.employeeId ? "/admin" : "/", label: u.role === "admin" && !u.employeeId ? "Setup checklist" : "Home", icon: u.role === "admin" && !u.employeeId ? "checklist" : "home" });
  const mine: NavLink[] = u.employeeId ? [{ href: "/leave", label: "My leave", icon: "leave" }, { href: "/attendance", label: "My attendance", icon: "finger" }, { href: "/payslips", label: "My payslips", icon: "receipt" }] : [];
  const team: NavLink[] = [];
  if (await P("approve")) {
    const pend = [...(await db().select().from(schema.leaveRequests).where(eq(schema.leaveRequests.status, "pending"))), ...(await db().select().from(schema.regRequests).where(eq(schema.regRequests.status, "pending")))];
    team.push({ href: "/approvals", label: "Approvals", icon: "approve", badge: (await actionable(u, pend)).length });
    if ((await departmentsHeadedBy(u.employeeId)).length) team.push({ href: "/team", label: "Team today", icon: "clock" });
  }
  const hr: NavLink[] = [];
  if (await P("reports")) hr.push({ href: "/hr", label: "Overview", icon: "overview" });
  if (await P("employees")) hr.push({ href: "/employees", label: "Employees", icon: "employees" }, { href: "/joiners", label: "New joiners", icon: "userplus", badge: await countToVerify() });
  if (await P("attendance")) hr.push({ href: "/attendance-register", label: "Attendance register", icon: "register" });
  if ((await P("employees")) || (await P("attendance"))) hr.push({ href: "/leave-register", label: "Leave register", icon: "calendar" });
  if (await P("payroll")) hr.push({ href: "/payroll", label: "Payroll", icon: "payroll" });
  if (await P("recruitment")) hr.push({ href: "/recruitment", label: "Recruitment", icon: "briefcase" }, { href: "/onboarding", label: "Joining checklist", icon: "checklist" });
  if (await P("masters")) bottom.push({ href: "/settings", label: "Settings", icon: "settings", match: ["/admin/"] });
  if (u.role === "admin") bottom.push({ href: "/admin/audit", label: "Change log", icon: "history" });
  // Office roles see their office work first; everyone else sees their own work first.
  const office = hr.length > 0;
  const groups: NavGroup[] = [];
  const add = (id: string, label: string, items: NavLink[], open: boolean) => { if (items.length) groups.push({ id, label, items, open }); };
  if (office) { add("hr", "HR office", hr, true); add("team", "My team", team, true); add("mine", "My work", mine, false); }
  else { add("mine", "My work", mine, true); add("team", "My team", team, true); }
  const login = u.login === "ADMIN" ? "admin" : `${org.prefix}-${u.login}`;
  const initials = u.name.replace(/^Dr\.?\s+/i, "").split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const data: NavData = { top, groups, bottom, org: { name: org.name, addr: org.addr, logo: org.logo, short: org.short }, me: { name: u.name, sub: `${ROLES[u.role as Role]} · ${login}`, initials, admin: u.role === "admin" } };
  return (
    <div className="app">
      <Nav data={data} />
      <main className="content">{DEMO && <div className="admin-note row between" role="status"><span><b>Demo with sample data.</b> Explore freely; everything you change is wiped every night at {DEMO_RESET_TIME}.</span>{u.role === "admin" && <Confirm label="Reset demo data now" confirm="Reset all demo data" action={resetDemo} danger={false} />}</div>}{!DEMO && banner && <div className="msg err" role="status">{banner}{u.role === "admin" && <> <a href="/admin/licence" style={{ color: "inherit", fontWeight: 600 }}>Manage licence</a></>}</div>}{children}<footer style={{ marginTop: 24, paddingTop: 12, borderTop: "1px solid var(--line)" }}><Powered /></footer></main>
    </div>
  );
}
