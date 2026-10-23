import { redirect } from "next/navigation";
import { and, desc, eq, gte } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser, can } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { attendanceGrid, balances, getEmployee, summarise } from "@/lib/logic";
import { fd, inr, monthLabel, nowIn } from "@/lib/dates";
import { Flash, Head, Pill } from "@/components/ui";

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const u = await requireUser();
  const sp = await searchParams;
  const emp = await getEmployee(u.employeeId);
  if (!emp) {
    if (sp.err || sp.ok) return <><Head title={`Welcome, ${u.name}`} /><Flash sp={sp} /></>;
    redirect(u.role === "admin" ? "/admin" : (await can(u, "reports")) ? "/hr" : "/profile");
  }
  const { org } = await getSettings();
  const today = nowIn(org.tz).date, m = today.slice(0, 7);
  const bal = await balances(emp.id, emp.category);
  const g = (await attendanceGrid([emp], `${m}-01`, today)).get(emp.id)!;
  const s = summarise(g), t = g[g.length - 1];
  const slip = (await db().select({ l: schema.payrollLines, r: schema.payrollRuns }).from(schema.payrollLines).innerJoin(schema.payrollRuns, eq(schema.payrollRuns.month, schema.payrollLines.month)).where(and(eq(schema.payrollLines.employeeId, emp.id), gte(schema.payrollRuns.step, 4))).orderBy(desc(schema.payrollLines.month)).limit(1))[0];
  const reqs = await db().select().from(schema.leaveRequests).where(eq(schema.leaveRequests.employeeId, emp.id)).orderBy(desc(schema.leaveRequests.appliedAt)).limit(5);
  const hour = Number(nowIn(org.tz).time.slice(0, 2));
  return (
    <>
      <Head title={`Good ${hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening"}, ${emp.name.split(" ").slice(0, 2).join(" ")}`} sub={<>{emp.designation} · {emp.department} · <span className="mono">{org.prefix}-{emp.id}</span></>}>
        <a className="btn primary" href="/leave">Apply leave</a>
      </Head>
      <Flash sp={sp} />
      <div className="card"><h2>Leave balance · {bal.year.label}</h2>
        {bal.rows.length ? <div className="bal">{bal.rows.map((r) => <div key={r.code}><b>{r.available}</b><small>{r.name}{r.pending ? ` · ${r.pending} pending` : ""}</small></div>)}</div> : <div className="empty">No leave types apply to your category yet.</div>}
      </div>
      <div className="grid g2">
        <div className="card"><h2>{monthLabel(m)} attendance</h2>
          <div className="grid g3" style={{ gap: 10 }}>
            <div className="stat"><b>{s.present}</b><small>days present</small></div>
            <div className="stat"><b>{s.late}</b><small>late marks</small></div>
            <div className="stat"><b>{s.working ? s.pct + "%" : "–"}</b><small>attendance</small></div>
          </div>
          <p className="hint" style={{ margin: "12px 0 0" }}>Today: {t.first ? `in at ${t.first}${t.sources ? ` (${t.sources})` : ""}` : t.st.toLowerCase()}.</p>
          <a className="btn sm" style={{ marginTop: 10 }} href="/attendance">Open calendar</a>
        </div>
        <div className="card"><h2>Latest payslip</h2>
          {slip ? <div className="row between"><div><div className="label">{monthLabel(slip.l.month)}</div><div className="stat"><b>{inr(slip.l.data.net)}</b><small>net pay</small></div></div><a className="btn sm" href="/payslips">View payslips</a></div> : <div className="empty">No payslips released yet.</div>}
        </div>
      </div>
      <div className="card"><h2>My recent requests</h2>
        {reqs.length ? <div className="list">{reqs.map((r) => <div key={r.id}><div><b>{r.type}</b> · {fd(r.fromDate, false)}{r.toDate !== r.fromDate ? " – " + fd(r.toDate, false) : ""} <span className="muted">({r.days} day{r.days === 1 ? "" : "s"})</span><div className="hint">{r.reason || "—"} · LV-{r.id}{r.status === "pending" ? ` · with ${r.chain[r.level]}` : ""}</div></div><Pill s={r.status} /></div>)}</div> : <div className="empty">No requests yet.</div>}
      </div>
    </>
  );
}
