import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser, can } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { actionable, departmentsHeadedBy } from "@/lib/logic";
import { MASTERS, ROLES, type Role } from "@/lib/config";
import { logout } from "@/app/actions/auth";
import Nav, { type NavItem } from "@/components/Nav";
import { Mark } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser();
  const { org } = await getSettings();
  const P = async (p: Parameters<typeof can>[1]) => can(u, p);
  const items: NavItem[] = [];
  if (u.employeeId) items.push({ label: "My work" }, { href: "/", label: "Home" }, { href: "/leave", label: "Leave" }, { href: "/attendance", label: "My attendance" }, { href: "/payslips", label: "Payslips" });
  const heads = await departmentsHeadedBy(u.employeeId);
  if (await P("approve")) {
    const pend = [...(await db().select().from(schema.leaveRequests).where(eq(schema.leaveRequests.status, "pending"))), ...(await db().select().from(schema.regRequests).where(eq(schema.regRequests.status, "pending")))];
    const n = (await actionable(u, pend)).length;
    items.push({ label: "Approvals" }, { href: "/approvals", label: "Approvals", badge: n });
    if (heads.length) items.push({ href: "/team", label: "Team today" });
  }
  const hr: NavItem[] = [];
  if (await P("reports")) hr.push({ href: "/hr", label: "Overview" });
  if (await P("employees")) hr.push({ href: "/employees", label: "Employees" });
  if (await P("attendance")) hr.push({ href: "/attendance-register", label: "Attendance register" });
  if ((await P("employees")) || (await P("attendance"))) hr.push({ href: "/leave-register", label: "Leave register" });
  if (await P("payroll")) hr.push({ href: "/payroll", label: "Payroll" });
  if (await P("recruitment")) hr.push({ href: "/recruitment", label: "Recruitment" }, { href: "/onboarding", label: "Onboarding" });
  if (hr.length) items.push({ label: "HR" }, ...hr);
  if (await P("masters")) {
    items.push({ label: "Settings" }, { href: "/admin/institute", label: "Institute profile", adm: true }, { href: "/admin/workflows", label: "Approval workflows", adm: true }, { href: "/admin/rules", label: "Attendance rules", adm: true });
    if (u.role === "admin") items.push({ href: "/admin/users", label: "Users & passwords", adm: true }, { href: "/admin/access", label: "Roles & access", adm: true });
    items.push({ label: "Master fields" }, ...MASTERS.map((m) => ({ href: `/admin/masters/${m.kind}`, label: m.title, adm: true })));
  }
  items.push({ label: "Account" }, { href: "/profile", label: "Profile & password" });
  if (u.role === "admin") items.push({ href: "/admin/audit", label: "Change log", adm: true });
  return (
    <>
      <header className="top">
        <a className="brand" href="/"><Mark org={org} /><div><b>{org.name}</b><small>HRMS · {org.addr}</small></div></a>
        <div className="who">
          <div className="me"><b>{u.name}</b><span>{ROLES[u.role as Role]} · {u.login === "ADMIN" ? "admin" : `${org.prefix}-${u.login}`}</span></div>
          <form action={logout}><button className="btn sm" type="submit">Sign out</button></form>
        </div>
      </header>
      <div className="shell">
        <Nav items={items} />
        <main>{children}</main>
      </div>
    </>
  );
}
