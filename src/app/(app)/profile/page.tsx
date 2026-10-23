import { requireUser, pwRuleText } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { getEmployee } from "@/lib/logic";
import { fd, fdt } from "@/lib/dates";
import { ROLES, type Role } from "@/lib/config";
import { changePassword } from "@/app/actions/auth";
import { Flash, Head } from "@/components/ui";

export default async function Profile({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const u = await requireUser();
  const sp = await searchParams;
  const { org, pol } = await getSettings();
  const e = await getEmployee(u.employeeId);
  const rows: [string, React.ReactNode][] = [["Login ID", <span key="l" className="mono">{u.login === "ADMIN" ? "admin" : `${org.prefix}-${u.login}`}</span>], ["Portal role", ROLES[u.role as Role]], ["Last sign-in", fdt(u.lastLogin, org.tz)]];
  if (e) rows.push(["Designation", e.designation], ["Department", e.department], ["Category", e.category], ["Date of joining", fd(e.doj) || "—"], ["Mobile", e.mobile || "—"], ["Email", e.email || "—"]);
  return (
    <>
      <Head title="Profile & password" sub="To correct your details, ask the HR office." />
      <Flash sp={sp} />
      <div className="grid g2">
        <div className="card"><h2>Your details</h2><div className="list">{rows.map(([k, v]) => <div key={k}><span className="muted">{k}</span><span>{v}</span></div>)}</div></div>
        <div className="card"><h2>Change password</h2>
          <form action={changePassword} className="stack">
            <div className="fld"><label htmlFor="current">Current password</label><input id="current" name="current" type="password" required autoComplete="current-password" /></div>
            <div className="fld"><label htmlFor="new">New password</label><input id="new" name="new" type="password" required autoComplete="new-password" /></div>
            <div className="fld"><label htmlFor="confirm">Confirm new password</label><input id="confirm" name="confirm" type="password" required autoComplete="new-password" /></div>
            <p className="hint" style={{ margin: 0 }}>{pwRuleText(pol)}</p>
            <div><button className="btn primary" type="submit">Update password</button></div>
          </form>
        </div>
      </div>
    </>
  );
}
