import { and, inArray, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { requirePerm } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { attendanceGrid, departmentsHeadedBy } from "@/lib/logic";
import { fd, nowIn } from "@/lib/dates";
import { Head, Pill, Stat } from "@/components/ui";

export default async function Team({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const u = await requirePerm("approve");
  const sp = await searchParams;
  const { org } = await getSettings();
  const depts = await departmentsHeadedBy(u.employeeId);
  if (!depts.length) return <><Head title="Team today" /><div className="card"><div className="empty">You are not set as head of any department. The Master Admin sets heads in Master fields → Departments.</div></div></>;
  const d = sp.d && /^\d{4}-\d{2}-\d{2}$/.test(sp.d) ? sp.d : nowIn(org.tz).date;
  const emps = await db().select().from(schema.employees).where(and(inArray(schema.employees.department, depts), ne(schema.employees.status, "Exited"))).orderBy(schema.employees.name);
  const g = await attendanceGrid(emps, d, d);
  const rows = emps.map((e) => ({ e, x: g.get(e.id)![0] }));
  const c = (s: string) => rows.filter((r) => r.x.st === s).length;
  return (
    <>
      <Head title="Team today" sub={`${depts.join(", ")} · ${fd(d)}`}>
        <form className="row"><input className="inp" type="date" name="d" defaultValue={d} aria-label="Date" style={{ width: 170 }} /><button className="btn sm" type="submit">Show</button></form>
      </Head>
      <div className="grid g4"><Stat n={c("Present") + c("Late") + c("Half day")} label="present" /><Stat n={c("Late")} label="late" /><Stat n={c("On leave")} label="on leave" /><Stat n={c("Not punched") + c("Absent")} label="not punched / absent" /></div>
      <div className="card"><div className="tw"><table><thead><tr><th>Name</th><th>Designation</th><th>Status</th><th>First in</th><th>Last out</th><th>Punched via</th></tr></thead>
        <tbody>{rows.map(({ e, x }) => <tr key={e.id}><td>{e.name}</td><td className="muted">{e.designation}</td><td><Pill s={x.st} />{x.leave ? <span className="hint"> {x.leave}</span> : null}</td><td className="num">{x.first || "—"}</td><td className="num">{x.last || "—"}</td><td className="muted">{x.sources || "—"}</td></tr>)}</tbody></table></div></div>
    </>
  );
}
