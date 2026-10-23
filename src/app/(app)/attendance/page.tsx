import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { attendanceGrid, getEmployee, holidayName, shiftInfo, summarise } from "@/lib/logic";
import { daysInMonth, dow, fd, monthLabel, nowIn, pad, prevMonth } from "@/lib/dates";
import { applyRegularise } from "@/app/actions/staff";
import { Flash, Head, Pill } from "@/components/ui";

const SHORT: Record<string, string> = { Present: "Present", Late: "Late", "Half day": "Half", "On leave": "Leave", Holiday: "Holiday", "Weekly off": "Off", Absent: "Absent", "Not punched": "", Upcoming: "", "Not tracked": "" };

export default async function MyAttendance({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const u = await requireUser();
  const sp = await searchParams;
  const emp = await getEmployee(u.employeeId);
  if (!emp) return <><Head title="My attendance" /><div className="empty">Your login is not linked to an employee record.</div></>;
  const { org } = await getSettings();
  const today = nowIn(org.tz).date;
  const m = sp.m && /^\d{4}-\d{2}$/.test(sp.m) ? sp.m : today.slice(0, 7);
  const last = `${m}-${pad(daysInMonth(m))}`;
  const days = (await attendanceGrid([emp], `${m}-01`, last)).get(emp.id)!;
  const sel = days.find((d) => d.date === sp.d) || days.find((d) => d.date === today) || days[0];
  const s = summarise(days.filter((d) => d.date <= today));
  const { map, def } = await shiftInfo();
  const sh = (emp.shift && map[emp.shift]) || def;
  const blanks = (dow(`${m}-01`) + 6) % 7;
  const next = m < today.slice(0, 7) ? (() => { const [y, mo] = m.split("-").map(Number); return mo === 12 ? `${y + 1}-01` : `${y}-${pad(mo + 1)}`; })() : null;
  const regs = await db().select().from(schema.regRequests).where(eq(schema.regRequests.employeeId, emp.id)).orderBy(desc(schema.regRequests.appliedAt)).limit(10);
  const hol = sel.st === "Holiday" ? await holidayName(sel.date) : undefined;
  return (
    <>
      <Head title="My attendance" sub={`${monthLabel(m)} · punches from every attendance source, merged into one record per day`}>
        <div className="row"><a className="btn sm" href={`/attendance?m=${prevMonth(m)}`}>← {monthLabel(prevMonth(m))}</a>{next && <a className="btn sm" href={`/attendance?m=${next}`}>{monthLabel(next)} →</a>}</div>
      </Head>
      <Flash sp={sp} />
      <div className="grid g4"><div className="card stat"><b>{s.present}</b><small>days present</small></div><div className="card stat"><b>{s.late}</b><small>late marks</small></div><div className="card stat"><b>{s.leave}</b><small>days on leave</small></div><div className="card stat"><b>{s.working ? s.pct + "%" : "–"}</b><small>attendance</small></div></div>
      <div className="grid g2">
        <div className="card">
          <div className="cal">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="dow">{d}</div>)}{Array.from({ length: blanks }, (_, i) => <div key={"b" + i} />)}
            {days.map((d) => <a key={d.date} href={`/attendance?m=${m}&d=${d.date}`} className={"d-" + d.st.split(" ")[0]} aria-current={d.date === sel.date ? "date" : undefined} aria-label={`${fd(d.date)}: ${d.st}`}><span>{Number(d.date.slice(8))}</span><small>{SHORT[d.st]}</small></a>)}
          </div>
          <p className="hint" style={{ margin: "12px 0 0" }}>Shift {emp.shift || "default"}: {sh.start} – {sh.end}, late after {sh.grace} minutes.</p>
        </div>
        <div className="card">
          <div className="label">{fd(sel.date)}</div>
          <h2 style={{ margin: "4px 0 10px" }}>{sel.st}{hol ? ` · ${hol}` : ""}{sel.leave ? ` · ${sel.leave}` : ""}</h2>
          {sel.punches.length ? <div className="list">{sel.punches.map((p) => <div key={p.id}><span><Pill s={p.direction} cls={p.direction === "In" ? "p-ok" : "p-mute"} /> <span className="num">{p.time}</span></span><span className="muted">{p.source}</span></div>)}</div> : <p className="muted" style={{ margin: 0 }}>No punches recorded.</p>}
          {sel.date <= today && <>
            <h3 style={{ margin: "18px 0 6px" }}>Missed a punch?</h3>
            <form action={applyRegularise} className="f">
              <input type="hidden" name="date" value={sel.date} />
              <div className="fld"><label htmlFor="direction">Punch</label><select id="direction" name="direction"><option>In</option><option>Out</option></select></div>
              <div className="fld"><label htmlFor="time">Time</label><input id="time" name="time" type="time" required /></div>
              <div className="fld wide"><label htmlFor="reason">Reason</label><input id="reason" name="reason" required placeholder="e.g. Face kiosk was down at the main gate" /></div>
              <div className="fld wide"><div><button className="btn sm primary" type="submit">Request regularisation for {fd(sel.date, false)}</button></div></div>
            </form>
          </>}
        </div>
      </div>
      {regs.length > 0 && <div className="card"><h2>My regularisation requests</h2><div className="list">{regs.map((r) => <div key={r.id}><span>{fd(r.date)} · {r.direction} {r.time} <span className="hint">{r.reason}</span></span><Pill s={r.status} /></div>)}</div></div>}
    </>
  );
}
