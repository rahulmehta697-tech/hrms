import { and, eq, gte, ne, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requirePerm } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { attendanceGrid, summarise } from "@/lib/logic";
import { addDays, fd, monthLabel, nowIn } from "@/lib/dates";
import { Head, Stat } from "@/components/ui";

export default async function HrOverview() {
  await requirePerm("reports");
  const { org, rules } = await getSettings();
  const today = nowIn(org.tz).date, m = today.slice(0, 7);
  const emps = await db().select().from(schema.employees).where(ne(schema.employees.status, "Exited"));
  const byCat = Object.entries(emps.reduce<Record<string, number>>((a, e) => ((a[e.category] = (a[e.category] || 0) + 1), a), {})).sort((a, b) => b[1] - a[1]);
  const mx = Math.max(1, ...byCat.map((x) => x[1]));
  const punched = Number((await db().select({ c: sql<number>`count(distinct ${schema.punches.employeeId})` }).from(schema.punches).where(eq(schema.punches.date, today)))[0].c);
  const bySrc = await db().select({ s: schema.punches.source, c: sql<number>`count(distinct ${schema.punches.employeeId})` }).from(schema.punches).where(eq(schema.punches.date, today)).groupBy(schema.punches.source);
  const smx = Math.max(1, ...bySrc.map((x) => Number(x.c)));
  const pending = Number((await db().select({ c: sql<number>`count(*)` }).from(schema.leaveRequests).where(eq(schema.leaveRequests.status, "pending")))[0].c) + Number((await db().select({ c: sql<number>`count(*)` }).from(schema.regRequests).where(eq(schema.regRequests.status, "pending")))[0].c);
  const thrEmps = emps.filter((e) => e.category === rules.thrCat);
  const g = await attendanceGrid(thrEmps, `${m}-01`, today);
  const low = thrEmps.map((e) => ({ e, s: summarise(g.get(e.id)!) })).filter((x) => x.s.working && x.s.pct < rules.thr).sort((a, b) => a.s.pct - b.s.pct).slice(0, 10);
  const run = (await db().select().from(schema.payrollRuns).where(eq(schema.payrollRuns.month, m)))[0];
  const reqs = await db().select().from(schema.requisitions).where(eq(schema.requisitions.status, "Open"));
  const joining = await db().select().from(schema.joiners).where(and(gte(schema.joiners.joinDate, today)));
  const noBank = emps.filter((e) => !e.bankAccount).length;
  return (
    <>
      <Head title="Overview" sub={`${fd(today)} · live figures`} />
      <div className="grid g4"><Stat n={emps.length.toLocaleString("en-IN")} label="employees on rolls" /><Stat n={`${punched.toLocaleString("en-IN")}${emps.length ? ` (${Math.round((punched / emps.length) * 100)}%)` : ""}`} label="punched in today" /><Stat n={pending} label="requests awaiting approval" /><Stat n={joining.length} label="joiners due" /></div>
      <div className="grid g2">
        <div className="card"><h2>Headcount by category</h2>{byCat.length ? byCat.map(([k, v]) => <div className="hbar" key={k}><span>{k}</span><div className="bar"><i style={{ width: `${(v / mx) * 100}%` }} /></div><span className="num" style={{ textAlign: "right" }}>{v.toLocaleString("en-IN")}</span></div>) : <div className="empty">No employees yet.</div>}</div>
        <div className="card"><h2>Today&apos;s punches by source</h2>{bySrc.length ? bySrc.map((x) => <div className="hbar" key={x.s}><span>{x.s}</span><div className="bar"><i style={{ width: `${(Number(x.c) / smx) * 100}%` }} /></div><span className="num" style={{ textAlign: "right" }}>{Number(x.c).toLocaleString("en-IN")}</span></div>) : <div className="empty">No punches for today yet. Import today&apos;s device files on the Attendance register.</div>}</div>
      </div>
      <div className="grid g2">
        {rules.thrCat ? <div className="card"><h2>Below {rules.thr}% this month · {rules.thrCat}</h2><p className="hint" style={{ margin: "-6px 0 10px" }}>{monthLabel(m)} so far. Threshold set in Attendance rules.</p>
          {low.length ? <div className="list">{low.map(({ e, s }) => <div key={e.id}><div>{e.name}<div className="hint">{e.designation} · {e.department}</div></div><span className="pill p-bad num">{s.pct}%</span></div>)}</div> : <div className="empty">No one below the threshold.</div>}</div>
          : <div className="card"><h2>Attendance threshold</h2><div className="empty">No minimum attendance is set. The Master Admin can set one in Attendance rules.</div></div>}
        <div className="card"><h2>{monthLabel(m)} payroll</h2>
          <p style={{ margin: "0 0 10px" }}>{["Not started", "Computed", "HR reviewed", "Accounts approved", "Closed and released"][run?.step || 0]}</p>
          <div className="bar"><i style={{ width: `${((run?.step || 0) / 4) * 100}%` }} /></div>
          {noBank > 0 && <p className="warnline">{noBank} employees have no bank account on record.</p>}
          <a className="btn sm" style={{ marginTop: 12 }} href="/payroll">Open payroll</a>
          <h3 style={{ margin: "18px 0 8px" }}>Open requisitions</h3>
          {reqs.length ? <div className="list">{reqs.map((r) => <div key={r.id}><span>{r.title} · {r.department}</span><span className="muted num">{r.posts} post{r.posts > 1 ? "s" : ""}</span></div>)}</div> : <p className="muted" style={{ margin: 0 }}>None open.</p>}
        </div>
      </div>
      {joining.length > 0 && <div className="card"><h2>Joining soon</h2><div className="list">{joining.filter((j) => j.joinDate! <= addDays(today, 30)).map((j) => <div key={j.id}><span>{j.name} · {j.roleText}</span><span className="muted">{fd(j.joinDate)}</span></div>)}</div></div>}
    </>
  );
}
