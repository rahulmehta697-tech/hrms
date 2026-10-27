import { sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requirePerm } from "@/lib/auth";
import { getMasters, getSettings } from "@/lib/settings";
import { licenceStatus } from "@/lib/license";
import { setupSteps } from "@/lib/setup";
import { ROLE_KEYS } from "@/lib/config";
import { Icon } from "@/components/icons";
import { Flash, Head } from "@/components/ui";

type Row = { href: string; label: string; meta?: string; todo?: string; ok?: string };
type Box = { title: string; icon: string; desc: string; rows: Row[] };

export default async function SettingsHub({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const u = await requirePerm("masters");
  const sp = await searchParams;
  const admin = u.role === "admin";
  const { org, rules, flows } = await getSettings();
  const m = await getMasters();
  const n = (k: string) => (m[k] || []).filter((r) => r.active).length;
  const cnt = (k: string): Pick<Row, "meta" | "todo"> => (n(k) ? { meta: String(n(k)) } : { todo: "Empty" });
  const year = new Date().getFullYear();
  const holThisYear = (m.hol || []).some((r) => r.active && String(r.data[0]).startsWith(String(year)));
  const users = admin ? Number((await db().select({ c: sql<number>`count(*)` }).from(schema.users))[0].c) : 0;
  const lic = admin ? await licenceStatus() : null;
  const { steps, done } = await setupSteps(u);

  const boxes: Box[] = [
    { title: "Organisation", icon: "building", desc: "Who you are and how you're structured.", rows: [
      { href: "/admin/institute", label: "Profile and logo", meta: org.short || undefined },
      { href: "/admin/masters/dept", label: "Departments", ...cnt("dept") },
      { href: "/admin/masters/desig", label: "Designations", ...cnt("desig") },
      { href: "/admin/masters/cat", label: "Employee categories", ...cnt("cat") },
    ] },
    { title: "People and access", icon: "lock", desc: "Logins, what each role can do, and who approves.", rows: [
      ...(admin ? [{ href: "/admin/users", label: "Users and passwords", meta: users.toLocaleString("en-IN") }, { href: "/admin/access", label: "Roles and access", meta: `${ROLE_KEYS.length} roles` }] : []),
      { href: "/admin/workflows", label: "Approval workflows", meta: String(flows.length) },
    ] },
    { title: "Time and attendance", icon: "clock", desc: "How punches become attendance, and leave rules.", rows: [
      { href: "/admin/rules", label: "Attendance rules", ...(rules.start ? { meta: rules.thrCat ? `${rules.thr}%` : "Set" } : { todo: "Not set" }) },
      { href: "/admin/masters/src", label: "Attendance sources", ...cnt("src") },
      { href: "/admin/masters/shift", label: "Shifts", ...cnt("shift") },
      { href: "/admin/masters/hol", label: "Holidays", ...(n("hol") ? (holThisYear ? { meta: String(n("hol")) } : { todo: `Add ${year}` }) : { todo: "Empty" }) },
      { href: "/admin/masters/leave", label: "Leave types", ...cnt("leave") },
    ] },
    { title: "Payroll and joining", icon: "payroll", desc: "Pay components and new-joiner steps.", rows: [
      { href: "/admin/masters/sal", label: "Salary components", ...cnt("sal") },
      { href: "/admin/masters/jdocs", label: "Joining documents", ...(n("jdocs") ? { meta: String(n("jdocs")) } : { todo: "Optional" }) },
      { href: "/admin/masters/docs", label: "Onboarding checklist", ...(n("docs") ? { meta: String(n("docs")) } : { todo: "Optional" }) },
    ] },
    ...(admin && lic ? [{ title: "Licence", icon: "shield", desc: "This copy's licence and limits.", rows: [
      { href: "/admin/licence", label: "Licence", ...(lic.state === "valid" ? { ok: "Valid" } : { todo: lic.state === "none" ? "Demo mode" : lic.state === "expiring" ? "Renew soon" : lic.state === "grace" ? "Expired" : lic.state === "expired" ? "Expired" : "Invalid" }), meta: Number.isFinite(lic.limit) ? `${lic.employees} / ${lic.limit}` : `${lic.employees}` },
    ] }] : []),
    ...(admin ? [{ title: "History", icon: "history", desc: "Every change, import and export.", rows: [{ href: "/admin/audit", label: "Change log" }] }] : []),
  ];

  return (
    <>
      <Head title="Settings" sub="Everything the Master Admin configures, in one place. Pick a section to open it." />
      <Flash sp={sp} />
      <a className="card setup-strip" href="/admin">
        <b>Setup {done} of {steps.length} done</b>
        <span className="bar" style={{ flex: 1 }}><i style={{ width: `${(done / steps.length) * 100}%` }} /></span>
        <span className="go">Open setup checklist</span>
      </a>
      <div className="hub">
        {boxes.map((b) => (
          <section className="card hubbox" key={b.title}>
            <h2><Icon name={b.icon} />{b.title}</h2>
            <p>{b.desc}</p>
            {b.rows.map((r) => (
              <a className="hubrow" href={r.href} key={r.href}>
                <span>{r.label}</span>
                {r.ok && <span className="pill p-ok">{r.ok}</span>}
                {r.todo && <span className="pill p-warn">{r.todo}</span>}
                {r.meta && <span className="meta">{r.meta}</span>}
                <Icon name="chevron" size={16} />
              </a>
            ))}
          </section>
        ))}
      </div>
    </>
  );
}
