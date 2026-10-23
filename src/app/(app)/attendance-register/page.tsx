import { and, asc, eq, ilike, ne, or, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { requirePerm } from "@/lib/auth";
import { activeList, getSettings } from "@/lib/settings";
import { barFor } from "@/lib/datasets";
import { attendanceGrid, summarise } from "@/lib/logic";
import { daysInMonth, fd, monthLabel, nowIn, pad } from "@/lib/dates";
import DataBar from "@/components/DataBar";
import { Flash, Head, Pager, Pill, Stat } from "@/components/ui";

const SIZE = 100;
export default async function AttendanceRegister({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const u = await requirePerm("attendance");
  const sp = await searchParams;
  const { org, rules } = await getSettings();
  const today = nowIn(org.tz).date;
  const view = sp.view === "month" ? "month" : "day";
  const d = sp.d && /^\d{4}-\d{2}-\d{2}$/.test(sp.d) ? sp.d : today;
  const m = sp.m && /^\d{4}-\d{2}$/.test(sp.m) ? sp.m : today.slice(0, 7);
  const dept = sp.dept || "", q = (sp.q || "").trim(), page = Math.max(1, Number(sp.p) || 1);
  const conds: SQL[] = [ne(schema.employees.status, "Exited")];
  if (dept) conds.push(eq(schema.employees.department, dept));
  if (q) conds.push(or(ilike(schema.employees.name, `%${q}%`), ilike(schema.employees.id, `%${q}%`))!);
  const emps = await db().select().from(schema.employees).where(and(...conds)).orderBy(asc(schema.employees.department), asc(schema.employees.name));
  const last = `${m}-${pad(daysInMonth(m))}`;
  const to = view === "day" ? d : last < today ? last : today;
  const from = view === "day" ? d : `${m}-01`;
  const g = await attendanceGrid(emps, from, to < from ? from : to);
  const punchBar = await barFor(u, "punches");
  const dayBar = await barFor(u, "attendance-day"), monBar = await barFor(u, "attendance-month");
  const params = new URLSearchParams({ ...(dept && { dept }), ...(view === "day" ? { d } : { m }) }).toString();
  const qs = (p: number) => "/attendance-register?" + new URLSearchParams({ view, ...(dept && { dept }), ...(q && { q }), ...(view === "day" ? { d } : { m }), p: String(p) });
  const depts = await activeList("dept");
  const dayRows = view === "day" ? emps.map((e) => ({ e, x: g.get(e.id)![0] })) : [];
  const monRows = view === "month" ? emps.map((e) => ({ e, s: summarise(g.get(e.id)!) })) : [];
  const c = (st: string) => dayRows.filter((r) => r.x.st === st).length;
  return (
    <>
      <Head title="Attendance register" sub="Built from punches of every active source. Import daily device files (for example the AEBAS export) as punches.">
        <DataBar ds="punches" importLabel="attendance punches" canImport={punchBar.canImport} canExport={false} />
      </Head>
      <Flash sp={sp} />
      <div className="tabs"><a href={`/attendance-register?view=day&d=${d}`} aria-current={view === "day" ? "page" : undefined}>Daily register</a><a href={`/attendance-register?view=month&m=${m}`} aria-current={view === "month" ? "page" : undefined}>Monthly summary</a></div>
      <form className="row" style={{ alignItems: "end" }}>
        <input type="hidden" name="view" value={view} />
        {view === "day" ? <div className="fld" style={{ flex: "0 1 180px" }}><label htmlFor="d">Date</label><input id="d" name="d" type="date" defaultValue={d} /></div>
          : <div className="fld" style={{ flex: "0 1 180px" }}><label htmlFor="m">Month</label><input id="m" name="m" type="month" defaultValue={m} /></div>}
        <div className="fld" style={{ flex: "0 1 220px" }}><label htmlFor="dept">Department</label><select id="dept" name="dept" defaultValue={dept}><option value="">All</option>{depts.map((x) => <option key={x}>{x}</option>)}</select></div>
        <div className="fld" style={{ flex: "1 1 200px" }}><label htmlFor="q">Search</label><input id="q" name="q" type="search" defaultValue={q} placeholder="Name or ID" /></div>
        <button className="btn" type="submit">Show</button>
        <span style={{ marginLeft: "auto" }}>{view === "day" ? <DataBar ds="attendance-day" params={params} canExport={dayBar.canExport} /> : <DataBar ds="attendance-month" params={params} canExport={monBar.canExport} />}</span>
      </form>
      {view === "day" ? <>
        <div className="grid g4"><Stat n={c("Present") + c("Late") + c("Half day")} label={`present on ${fd(d, false)}`} /><Stat n={c("Late")} label="late" /><Stat n={c("On leave")} label="on leave" /><Stat n={c(d === today ? "Not punched" : "Absent")} label={d === today ? "not punched yet" : "absent"} /></div>
        <div className="card">{dayRows.length ? <div className="tw"><table><thead><tr><th>Employee</th><th>Department</th><th>First in</th><th>Last out</th><th className="r">Hours</th><th>Sources</th><th>Status</th></tr></thead>
          <tbody>{dayRows.slice((page - 1) * SIZE, page * SIZE).map(({ e, x }) => <tr key={e.id}><td>{e.name}<div className="hint mono">{org.prefix}-{e.id}</div></td><td className="muted">{e.department}</td><td className="num">{x.first || "—"}</td><td className="num">{x.last || "—"}</td><td className="r num">{x.hours || "—"}</td><td className="muted">{x.sources || "—"}{x.n > 1 && <span className="hint"> ({x.n})</span>}</td><td><Pill s={x.st} /></td></tr>)}</tbody></table></div> : <div className="empty">No employees match.</div>}
          <Pager page={page} total={dayRows.length} size={SIZE} href={qs} /></div>
      </> : <div className="card">
        <p className="hint" style={{ marginTop: 0 }}>{monthLabel(m)} up to {fd(to < from ? from : to)}. Employees below {rules.thr}% in {rules.thrCat} are highlighted.</p>
        {monRows.length ? <div className="tw"><table><thead><tr><th>Employee</th><th>Department</th><th className="r">Present</th><th className="r">Late</th><th className="r">Leave</th><th className="r">Absent</th><th className="r">Working days</th><th className="r">Attendance</th></tr></thead>
          <tbody>{monRows.slice((page - 1) * SIZE, page * SIZE).map(({ e, s }) => <tr key={e.id}><td>{e.name}<div className="hint mono">{org.prefix}-{e.id}</div></td><td className="muted">{e.department}</td><td className="r num">{s.present}</td><td className="r num">{s.late}</td><td className="r num">{s.leave}</td><td className="r num">{s.absent}</td><td className="r num">{s.working}</td><td className="r num"><span className={"pill " + (e.category === rules.thrCat && s.working && s.pct < rules.thr ? "p-bad" : "p-mute")}>{s.working ? s.pct + "%" : "–"}</span></td></tr>)}</tbody></table></div> : <div className="empty">No employees match.</div>}
        <Pager page={page} total={monRows.length} size={SIZE} href={qs} /></div>}
    </>
  );
}
